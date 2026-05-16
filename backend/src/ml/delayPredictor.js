/**
 * Delay Prediction ML Model
 *
 * Multivariate linear regression trained on historical trip_delays records.
 * Implemented entirely in plain JavaScript using mini-batch gradient descent
 * with L2 regularisation — no external ML library required.
 *
 * Features (all normalised to [0, 1]):
 *   f0  hour_norm          departure hour / 23
 *   f1  dow_norm           day-of-week / 6  (Mon=0 … Sun=6)
 *   f2  morning_rush       1 if hour ∈ [7,9]
 *   f3  evening_rush       1 if hour ∈ [16,18]
 *   f4  weekend            1 if day ∈ {5,6}
 *   f5  route_hist_norm    per-route historical avg delay / HIST_CAP
 *   f6  route_freq_norm    count of delays on this route / MAX_FREQ (log-scaled)
 *
 * Label: delay_minutes (continuous, non-negative)
 */

const HIST_CAP    = 120;   // cap historical avg at 120 min for normalisation
const EPOCHS      = 800;
const LR          = 0.005;
const LAMBDA      = 0.001; // L2 regularisation strength
const FEATURE_DIM = 7;

// ── Internal helpers ──────────────────────────────────────────────────────────

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function featurize(hourOfDay, dayOfWeek, routeHistAvg, routeFreq, maxFreq) {
  return [
    hourOfDay / 23,
    dayOfWeek / 6,
    hourOfDay >= 7 && hourOfDay <= 9  ? 1 : 0,   // morning rush
    hourOfDay >= 16 && hourOfDay <= 18 ? 1 : 0,  // evening rush
    dayOfWeek >= 5                     ? 1 : 0,  // weekend
    Math.min(routeHistAvg, HIST_CAP) / HIST_CAP,
    maxFreq > 0 ? Math.log1p(routeFreq) / Math.log1p(maxFreq) : 0,
  ];
}

// ── DelayPredictor class ──────────────────────────────────────────────────────

export class DelayPredictor {
  constructor() {
    this._w           = new Float64Array(FEATURE_DIM).fill(0);
    this._bias        = 0;
    this._routeAvg    = {};   // route_id → avg delay_minutes
    this._routeFreq   = {};   // route_id → count of delay records
    this._globalAvg   = 0;
    this._maxFreq     = 1;
    this._trained     = false;
    this._trainedAt   = null;
    this._sampleCount = 0;
    this._rmse        = null;
  }

  // ── Training ───────────────────────────────────────────────────────────────

  /**
   * @param {Array<{delay_minutes:number, route_id:number, start_time:string}>} rows
   */
  train(rows) {
    if (!rows || rows.length === 0) return;

    // ── 1. Compute per-route statistics ─────────────────────────────────────
    const rSums = {};
    const rCounts = {};
    rows.forEach(r => {
      const rid = String(r.route_id ?? "0");
      rSums[rid]   = (rSums[rid]   ?? 0) + r.delay_minutes;
      rCounts[rid] = (rCounts[rid] ?? 0) + 1;
    });

    this._routeAvg  = {};
    this._routeFreq = {};
    Object.keys(rSums).forEach(rid => {
      this._routeAvg[rid]  = rSums[rid] / rCounts[rid];
      this._routeFreq[rid] = rCounts[rid];
    });
    this._globalAvg = rows.reduce((s, r) => s + r.delay_minutes, 0) / rows.length;
    this._maxFreq   = Math.max(...Object.values(this._routeFreq), 1);

    // ── 2. Build design matrix & label vector ────────────────────────────────
    const X = [];
    const y = [];

    rows.forEach(r => {
      const dt  = new Date(r.start_time ?? r.reported_at ?? Date.now());
      const hour = dt.getHours();
      const dow  = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // Sun=0→6, Mon=1→0
      const rid  = String(r.route_id ?? "0");

      X.push(featurize(
        hour, dow,
        this._routeAvg[rid]  ?? this._globalAvg,
        this._routeFreq[rid] ?? 0,
        this._maxFreq
      ));
      y.push(r.delay_minutes);
    });

    const n = X.length;

    // ── 3. Gradient descent with L2 regularisation ───────────────────────────
    const w    = new Float64Array(FEATURE_DIM).fill(0);
    let   bias = 0;

    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      const grad = new Float64Array(FEATURE_DIM).fill(0);
      let   dBias = 0;
      let   loss  = 0;

      for (let i = 0; i < n; i++) {
        const pred = dot(X[i], w) + bias;
        const err  = pred - y[i];
        loss += err * err;
        dBias += err;
        for (let j = 0; j < FEATURE_DIM; j++) grad[j] += err * X[i][j];
      }

      // Apply gradients with L2 on weights (not bias)
      for (let j = 0; j < FEATURE_DIM; j++) {
        w[j] -= LR * ((2 / n) * grad[j] + 2 * LAMBDA * w[j]);
      }
      bias -= LR * (2 / n) * dBias;

      // Early-stop when MSE is negligible
      if (loss / n < 0.01) break;
    }

    // ── 4. Compute training RMSE ─────────────────────────────────────────────
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const pred = dot(X[i], w) + bias;
      sse += (pred - y[i]) ** 2;
    }

    this._w           = w;
    this._bias        = bias;
    this._trained     = true;
    this._trainedAt   = new Date();
    this._sampleCount = n;
    this._rmse        = Math.sqrt(sse / n);
  }

  // ── Prediction ─────────────────────────────────────────────────────────────

  /**
   * Predict expected delay for a given route + departure time.
   *
   * @param {number|string} routeId
   * @param {string|Date}   departureTime  ISO string or Date
   * @returns {{ predicted_delay_minutes, risk_level, confidence, factors, meta }}
   */
  predict(routeId, departureTime) {
    const dt   = new Date(departureTime);
    const hour = isNaN(dt) ? 12 : dt.getHours();
    const rawDow = isNaN(dt) ? 1  : dt.getDay();
    const dow  = rawDow === 0 ? 6 : rawDow - 1;
    const rid  = String(routeId ?? "0");

    const histAvg = this._routeAvg[rid] ?? this._globalAvg;
    const freq    = this._routeFreq[rid] ?? 0;

    const features = featurize(hour, dow, histAvg, freq, this._maxFreq);
    let raw = this._trained ? dot(features, this._w) + this._bias : histAvg;
    const predicted = Math.max(0, Math.round(raw));

    // ── Risk level ─────────────────────────────────────────────────────────
    const risk_level =
      predicted >= 20 ? "high" :
      predicted >= 8  ? "moderate" :
                        "low";

    // ── Confidence ─────────────────────────────────────────────────────────
    const confidence =
      this._sampleCount >= 100 ? "high" :
      this._sampleCount >= 25  ? "medium" :
                                 "low";

    // ── Explanatory factors ────────────────────────────────────────────────
    const factors = [];
    if (hour >= 7  && hour <= 9)  factors.push("morning_rush_hour");
    if (hour >= 16 && hour <= 18) factors.push("evening_rush_hour");
    if (dow >= 5)                 factors.push("weekend_reduced_service");
    if (histAvg > 15)             factors.push("historically_delayed_route");
    if (freq > 5)                 factors.push("frequent_delay_reports");
    if (factors.length === 0)     factors.push("no_significant_risk_factors");

    return {
      predicted_delay_minutes: predicted,
      risk_level,
      confidence,
      factors,
      meta: {
        trained:        this._trained,
        trained_at:     this._trainedAt,
        trained_on:     this._sampleCount,
        training_rmse:  this._rmse ? +this._rmse.toFixed(2) : null,
        route_hist_avg: +histAvg.toFixed(1),
        note: this._trained
          ? `Model trained on ${this._sampleCount} historical delay records.`
          : "Model not yet trained — returning route historical average.",
      },
    };
  }

  get isTrained() { return this._trained; }
}

// Singleton shared across all requests
export const predictor = new DelayPredictor();
