/**
 * Delay Prediction ML Model — Yalla Transit
 *
 * Algorithm : Multivariate linear regression with L2 (ridge) regularisation.
 * Training  : Full-batch gradient descent with adaptive learning-rate decay
 *             and delta-based early stopping.
 * Features  : 9 dimensions after cyclical encoding (all z-score standardised):
 *
 *   f0  hour_sin            sin(2π·hour/24)
 *   f1  hour_cos            cos(2π·hour/24)
 *   f2  dow_sin             sin(2π·dow/7)
 *   f3  dow_cos             cos(2π·dow/7)
 *   f4  is_morning_rush     1 ∈ [07,09]
 *   f5  is_evening_rush     1 ∈ [16,18]
 *   f6  is_weekend          1 if Sat/Sun
 *   f7  route_hist_avg_norm historical avg delay / 120 (capped)
 *   f8  route_freq_norm     log1p(route_delay_count) / log1p(max_count)
 *
 * Label     : delay_minutes  (non-negative real, clipped at prediction)
 *
 * Seed data : When the DB contains < SYNTHETIC_THRESHOLD records the model
 *             is augmented with 500+ synthetic rows so it always produces
 *             sensible output even with an empty database.
 */

import {
  dotProduct, standardize, applyStandardize, cyclical,
  syntheticDelayRows, SYNTHETIC_THRESHOLD,
} from "./mlUtils.js";

const FEATURE_DIM = 9;
const MAX_EPOCHS  = 1000;
const LR_INIT     = 0.05;
const LR_DECAY    = 0.9;       // multiply LR every 100 epochs
const LAMBDA      = 0.0005;    // L2 strength
const HIST_CAP    = 120;

// ── Raw feature builder (pre-standardisation) ─────────────────────────────────

function rawFeatures(hour, dow, routeHistAvg, routeFreq, maxFreq) {
  const [hs, hc]  = cyclical(hour, 24);
  const [ds, dc]  = cyclical(dow,  7);
  return [
    hs,
    hc,
    ds,
    dc,
    hour >= 7  && hour <= 9  ? 1 : 0,
    hour >= 16 && hour <= 18 ? 1 : 0,
    dow >= 5                 ? 1 : 0,
    Math.min(routeHistAvg, HIST_CAP) / HIST_CAP,
    maxFreq > 0 ? Math.log1p(routeFreq) / Math.log1p(maxFreq) : 0,
  ];
}

// ── DelayPredictor ────────────────────────────────────────────────────────────

export class DelayPredictor {
  constructor() {
    this._w           = new Float64Array(FEATURE_DIM).fill(0);
    this._bias        = 0;
    this._fMeans      = new Array(FEATURE_DIM).fill(0);
    this._fStds       = new Array(FEATURE_DIM).fill(1);
    this._routeAvg    = {};
    this._routeFreq   = {};
    this._globalAvg   = 0;
    this._maxFreq     = 1;
    this._trained     = false;
    this._trainedAt   = null;
    this._sampleCount = 0;
    this._rmse        = null;
    this._mae         = null;
    this._epochs      = 0;
    this._augmented   = false;
  }

  // ── Public getters ──────────────────────────────────────────────────────────

  get isTrained()    { return this._trained; }
  get sampleCount()  { return this._sampleCount; }
  get trainedAt()    { return this._trainedAt; }
  get rmse()         { return this._rmse; }
  get mae()          { return this._mae; }
  get wasAugmented() { return this._augmented; }

  /** Full model description for monitoring / admin UI. */
  describe() {
    return {
      algorithm:      "multivariate_linear_regression",
      regularisation: "L2 ridge (λ=0.0005)",
      features:       FEATURE_DIM,
      feature_names: [
        "hour_sin","hour_cos","dow_sin","dow_cos",
        "morning_rush","evening_rush","weekend",
        "route_hist_avg","route_freq",
      ],
      trained:        this._trained,
      trained_at:     this._trainedAt,
      trained_on:     this._sampleCount,
      augmented_with_synthetic: this._augmented,
      training_rmse:  this._rmse  != null ? +this._rmse.toFixed(3)  : null,
      training_mae:   this._mae   != null ? +this._mae.toFixed(3)   : null,
      epochs_run:     this._epochs,
    };
  }

  // ── Training ────────────────────────────────────────────────────────────────

  /**
   * Train on historical delay records.
   * Automatically augments with synthetic data if rows < SYNTHETIC_THRESHOLD.
   *
   * @param {Array<{ delay_minutes:number, route_id:number|string, start_time:string }>} rows
   */
  train(rows) {
    let data = rows ?? [];

    if (data.length < SYNTHETIC_THRESHOLD) {
      data = [...data, ...syntheticDelayRows()];
      this._augmented = true;
    } else {
      this._augmented = false;
    }

    if (!data.length) return;

    // ── 1. Per-route statistics ──────────────────────────────────────────────
    const rSums   = {};
    const rCounts = {};
    for (const r of data) {
      const rid = String(r.route_id ?? "0");
      rSums[rid]   = (rSums[rid]   ?? 0) + r.delay_minutes;
      rCounts[rid] = (rCounts[rid] ?? 0) + 1;
    }
    this._routeAvg  = {};
    this._routeFreq = {};
    for (const rid of Object.keys(rSums)) {
      this._routeAvg[rid]  = rSums[rid] / rCounts[rid];
      this._routeFreq[rid] = rCounts[rid];
    }
    this._globalAvg = data.reduce((s, r) => s + r.delay_minutes, 0) / data.length;
    this._maxFreq   = Math.max(...Object.values(this._routeFreq), 1);

    // ── 2. Build raw design matrix & labels ──────────────────────────────────
    const Xraw = [];
    const y    = [];

    for (const r of data) {
      const dt  = new Date(r.start_time ?? r.reported_at ?? Date.now());
      const h   = isNaN(dt) ? 12 : dt.getUTCHours();
      const dow = isNaN(dt) ? 0  : (dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1);
      const rid = String(r.route_id ?? "0");

      Xraw.push(rawFeatures(
        h, dow,
        this._routeAvg[rid]  ?? this._globalAvg,
        this._routeFreq[rid] ?? 0,
        this._maxFreq
      ));
      y.push(r.delay_minutes);
    }

    // ── 3. Z-score standardisation ────────────────────────────────────────────
    const { Xz, means, stds } = standardize(Xraw);
    this._fMeans = means;
    this._fStds  = stds;

    const n = Xz.length;
    const w = new Float64Array(FEATURE_DIM).fill(0);
    let bias = this._globalAvg; // warm-start bias at global mean

    // ── 4. Gradient descent with LR decay & early stopping ───────────────────
    let prevLoss = Infinity;
    let lr       = LR_INIT;
    let epoch;

    for (epoch = 0; epoch < MAX_EPOCHS; epoch++) {
      if (epoch > 0 && epoch % 100 === 0) lr *= LR_DECAY;

      const grad  = new Float64Array(FEATURE_DIM).fill(0);
      let dBias = 0;
      let loss  = 0;

      for (let i = 0; i < n; i++) {
        const pred = dotProduct(Xz[i], w) + bias;
        const err  = pred - y[i];
        loss  += err * err;
        dBias += err;
        for (let j = 0; j < FEATURE_DIM; j++) grad[j] += err * Xz[i][j];
      }

      const mse = loss / n;
      if (epoch > 50 && Math.abs(prevLoss - mse) < 1e-6) break; // converged
      prevLoss = mse;

      for (let j = 0; j < FEATURE_DIM; j++) {
        w[j] -= lr * ((2 / n) * grad[j] + 2 * LAMBDA * w[j]);
      }
      bias -= lr * (2 / n) * dBias;
    }

    // ── 5. Training metrics ───────────────────────────────────────────────────
    let sse = 0, sae = 0;
    for (let i = 0; i < n; i++) {
      const pred = dotProduct(Xz[i], w) + bias;
      sse += (pred - y[i]) ** 2;
      sae += Math.abs(pred - y[i]);
    }

    this._w           = w;
    this._bias        = bias;
    this._trained     = true;
    this._trainedAt   = new Date();
    this._sampleCount = n;
    this._rmse        = Math.sqrt(sse / n);
    this._mae         = sae / n;
    this._epochs      = epoch;
  }

  // ── Prediction ──────────────────────────────────────────────────────────────

  /**
   * Predict the expected delay for a route + departure time.
   *
   * @param {number|string} routeId
   * @param {string|Date}   departureTime
   * @returns {DelayPrediction}
   */
  predict(routeId, departureTime) {
    const dt     = new Date(departureTime);
    const hour   = isNaN(dt) ? 12 : dt.getUTCHours();
    const rawDow = isNaN(dt) ? 1  : dt.getUTCDay();
    const dow    = rawDow === 0 ? 6 : rawDow - 1;
    const rid    = String(routeId ?? "0");

    const histAvg = this._routeAvg[rid]  ?? this._globalAvg;
    const freq    = this._routeFreq[rid] ?? 0;

    let predicted;
    if (this._trained) {
      const raw = rawFeatures(hour, dow, histAvg, freq, this._maxFreq);
      const z   = applyStandardize(raw, this._fMeans, this._fStds);
      predicted = Math.max(0, Math.round(dotProduct(z, this._w) + this._bias));
    } else {
      // Untrained: fall back to route historical average
      predicted = Math.max(0, Math.round(histAvg));
    }

    const risk_level =
      predicted >= 20 ? "high"     :
      predicted >= 8  ? "moderate" : "low";

    const confidence =
      this._sampleCount >= 100 ? "high"   :
      this._sampleCount >= 25  ? "medium" : "low";

    const factors = [];
    if (hour >= 7  && hour <= 9)  factors.push("morning_rush_hour");
    if (hour >= 16 && hour <= 18) factors.push("evening_rush_hour");
    if (dow  >= 5)                factors.push("weekend_reduced_service");
    if (histAvg > 15)             factors.push("historically_delayed_route");
    if (freq > 5)                 factors.push("frequent_delay_reports");
    if (!factors.length)          factors.push("no_significant_risk_factors");

    return {
      predicted_delay_minutes:  predicted,
      risk_level,
      confidence,
      factors,
      route_id:    Number(routeId),
      departure_time: dt instanceof Date && !isNaN(dt) ? dt.toISOString() : new Date().toISOString(),
      model: {
        trained:         this._trained,
        trained_at:      this._trainedAt,
        trained_on:      this._sampleCount,
        training_rmse:   this._rmse != null ? +this._rmse.toFixed(2) : null,
        training_mae:    this._mae  != null ? +this._mae.toFixed(2)  : null,
        route_hist_avg:  +histAvg.toFixed(1),
        note: this._trained
          ? `Model trained on ${this._sampleCount} records (RMSE ${this._rmse?.toFixed(1)} min).`
          : "Model not yet trained — returning route historical average.",
      },
    };
  }
}

export const predictor = new DelayPredictor();
