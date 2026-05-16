/**
 * Predictive Demand Analytics — Yalla Transit
 *
 * Forecasts expected passenger occupancy for upcoming trips using a
 * two-stage hybrid model:
 *
 *   Stage 1 — Bucket model (primary)
 *     For each (route_id, day-of-week, 2-hour slot) triplet the model
 *     computes a weighted rolling average of historical occupancy.
 *     Buckets capture the strong periodicity of transit demand:
 *     rush hours, school patterns, weekday vs weekend.
 *
 *   Stage 2 — Linear regression (residual/trend layer)
 *     A ridge-regularised regression trained on the same dataset captures
 *     cross-feature interactions not covered by individual buckets.
 *     Uses z-score standardised features + cyclical time encoding.
 *
 *   Final prediction = α·bucket + (1-α)·regression
 *   where α = confidence weight based on bucket sample depth.
 *
 * Features (9 dimensions):
 *   f0  hour_sin           sin(2π·hour/24)
 *   f1  hour_cos           cos(2π·hour/24)
 *   f2  dow_sin            sin(2π·dow/7)
 *   f3  dow_cos            cos(2π·dow/7)
 *   f4  is_morning_rush    1 ∈ [07,09]
 *   f5  is_afternoon_peak  1 ∈ [12,14]
 *   f6  is_evening_rush    1 ∈ [16,19]
 *   f7  is_weekend
 *   f8  route_hist_occ     historical avg occupancy fraction (0-1)
 *
 * Seed data: Automatically augments with synthetic Lebanese transit data
 * when DB has < SYNTHETIC_THRESHOLD records.
 */

import {
  dotProduct, standardize, applyStandardize, cyclical,
  syntheticDemandRows, SYNTHETIC_THRESHOLD,
} from "./mlUtils.js";

const FEATURE_DIM   = 9;
const MAX_EPOCHS    = 800;
const LR_INIT       = 0.03;
const LR_DECAY      = 0.92;
const LAMBDA        = 0.001;
const HOUR_SLOT_SZ  = 2;        // bucket granularity (hours)

// ── Bucket helpers ────────────────────────────────────────────────────────────

function hourSlot(hour) { return Math.floor(hour / HOUR_SLOT_SZ) * HOUR_SLOT_SZ; }

function bucketKey(routeId, dow, hour) {
  return `${routeId}:${dow}:${hourSlot(hour)}`;
}

// ── Feature builder (pre-standardisation) ─────────────────────────────────────

function rawFeatures(hour, dow, routeHistOcc) {
  const [hs, hc] = cyclical(hour, 24);
  const [ds, dc] = cyclical(dow,  7);
  return [
    hs,
    hc,
    ds,
    dc,
    hour >= 7  && hour <= 9  ? 1 : 0,   // morning rush
    hour >= 12 && hour <= 14 ? 1 : 0,   // lunch peak
    hour >= 16 && hour <= 19 ? 1 : 0,   // evening rush
    dow  >= 5                ? 1 : 0,   // weekend
    Math.min(Math.max(routeHistOcc, 0), 1),
  ];
}

// ── DemandPredictor ───────────────────────────────────────────────────────────

export class DemandPredictor {
  constructor() {
    this._buckets       = {};  // key → { sum, count }
    this._routeCapacity = {};  // route_id → median capacity seen
    this._routeHistOcc  = {};  // route_id → avg occupancy fraction
    this._globalHistOcc = 0;
    this._w             = new Float64Array(FEATURE_DIM).fill(0);
    this._bias          = 0;
    this._fMeans        = new Array(FEATURE_DIM).fill(0);
    this._fStds         = new Array(FEATURE_DIM).fill(1);
    this._trained       = false;
    this._trainedAt     = null;
    this._sampleCount   = 0;
    this._mae           = null;
    this._rmse          = null;
    this._epochs        = 0;
    this._augmented     = false;
  }

  // ── Public getters ──────────────────────────────────────────────────────────

  get isTrained()    { return this._trained; }
  get sampleCount()  { return this._sampleCount; }
  get trainedAt()    { return this._trainedAt; }
  get rmse()         { return this._rmse; }
  get mae()          { return this._mae; }
  get wasAugmented() { return this._augmented; }

  describe() {
    return {
      algorithm:       "hybrid_bucket_regression",
      stages:          ["bucket_rolling_avg (primary)", "L2_linear_regression (residual)"],
      regularisation:  "L2 ridge (λ=0.001)",
      features:        FEATURE_DIM,
      bucket_slots:    `${HOUR_SLOT_SZ}-hour`,
      trained:         this._trained,
      trained_at:      this._trainedAt,
      trained_on:      this._sampleCount,
      augmented_with_synthetic: this._augmented,
      training_rmse:   this._rmse  != null ? +this._rmse.toFixed(3)  : null,
      training_mae:    this._mae   != null ? +this._mae.toFixed(3)   : null,
      epochs_run:      this._epochs,
    };
  }

  // ── Training ────────────────────────────────────────────────────────────────

  /**
   * @param {Array<{ route_id, capacity, passengers, start_time }>} rows
   */
  train(rows) {
    let data = rows ?? [];

    if (data.length < SYNTHETIC_THRESHOLD) {
      data = [...data, ...syntheticDemandRows()];
      this._augmented = true;
    } else {
      this._augmented = false;
    }

    if (!data.length) return;

    // ── 1. Per-route metadata ─────────────────────────────────────────────────
    const rCapSums = {}, rCapCounts = {}, rOccSums = {}, rOccCounts = {};
    for (const r of data) {
      const rid = String(r.route_id ?? "0");
      const cap = r.capacity ?? 40;
      const occ = r.passengers / cap;
      rCapSums[rid]   = (rCapSums[rid]   ?? 0) + cap;
      rCapCounts[rid] = (rCapCounts[rid] ?? 0) + 1;
      rOccSums[rid]   = (rOccSums[rid]   ?? 0) + occ;
      rOccCounts[rid] = (rOccCounts[rid] ?? 0) + 1;
    }
    this._routeCapacity = {};
    this._routeHistOcc  = {};
    for (const rid of Object.keys(rCapSums)) {
      this._routeCapacity[rid] = Math.round(rCapSums[rid] / rCapCounts[rid]);
      this._routeHistOcc[rid]  = rOccSums[rid] / rOccCounts[rid];
    }
    this._globalHistOcc = data.reduce((s, r) => s + r.passengers / (r.capacity ?? 40), 0) / data.length;

    // ── 2. Build bucket model ─────────────────────────────────────────────────
    const buckets = {};
    for (const r of data) {
      const dt  = new Date(r.start_time ?? Date.now());
      const h   = isNaN(dt) ? 12 : dt.getUTCHours();
      const dow = isNaN(dt) ? 1  : (dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1);
      const rid = String(r.route_id ?? "0");
      const cap = r.capacity ?? 40;
      const key = bucketKey(rid, dow, h);

      if (!buckets[key]) buckets[key] = { sum: 0, count: 0, cap };
      buckets[key].sum   += r.passengers;
      buckets[key].count += 1;
    }
    this._buckets = buckets;

    // ── 3. Build regression on occupancy fraction (0-1) ───────────────────────
    const Xraw = [];
    const y    = [];

    for (const r of data) {
      const dt  = new Date(r.start_time ?? Date.now());
      const h   = isNaN(dt) ? 12 : dt.getUTCHours();
      const dow = isNaN(dt) ? 1  : (dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1);
      const rid = String(r.route_id ?? "0");

      Xraw.push(rawFeatures(h, dow, this._routeHistOcc[rid] ?? this._globalHistOcc));
      y.push(r.passengers / (r.capacity ?? 40));   // label: occupancy fraction
    }

    const { Xz, means, stds } = standardize(Xraw);
    this._fMeans = means;
    this._fStds  = stds;

    const n = Xz.length;
    const w = new Float64Array(FEATURE_DIM).fill(0);
    let bias = this._globalHistOcc;

    let prevLoss = Infinity;
    let lr = LR_INIT;
    let epoch;

    for (epoch = 0; epoch < MAX_EPOCHS; epoch++) {
      if (epoch > 0 && epoch % 100 === 0) lr *= LR_DECAY;

      const grad = new Float64Array(FEATURE_DIM).fill(0);
      let dBias = 0, loss = 0;

      for (let i = 0; i < n; i++) {
        const pred = dotProduct(Xz[i], w) + bias;
        const err  = pred - y[i];
        loss  += err * err;
        dBias += err;
        for (let j = 0; j < FEATURE_DIM; j++) grad[j] += err * Xz[i][j];
      }

      const mse = loss / n;
      if (epoch > 50 && Math.abs(prevLoss - mse) < 1e-8) break;
      prevLoss = mse;

      for (let j = 0; j < FEATURE_DIM; j++) {
        w[j] -= lr * ((2 / n) * grad[j] + 2 * LAMBDA * w[j]);
      }
      bias -= lr * (2 / n) * dBias;
    }

    // ── 4. Training metrics ───────────────────────────────────────────────────
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
   * Predict passenger demand for a route at a given departure time.
   *
   * @param {number|string} routeId
   * @param {string|Date}   departureTime
   * @returns {DemandPrediction}
   */
  predict(routeId, departureTime) {
    const dt     = new Date(departureTime);
    const hour   = isNaN(dt) ? 12 : dt.getUTCHours();
    const rawDow = isNaN(dt) ? 1  : dt.getUTCDay();
    const dow    = rawDow === 0 ? 6 : rawDow - 1;
    const rid    = String(routeId ?? "0");

    const cap     = this._routeCapacity[rid] ?? 40;
    const histOcc = this._routeHistOcc[rid]  ?? this._globalHistOcc;

    // ── Stage 1: bucket prediction ───────────────────────────────────────────
    const key    = bucketKey(rid, dow, hour);
    const bucket = this._buckets[key];
    const bAvgPax = bucket ? bucket.sum / bucket.count : null;
    const bOcc    = bAvgPax != null ? bAvgPax / cap : null;

    // ── Stage 2: regression prediction ───────────────────────────────────────
    let regOcc;
    if (this._trained) {
      const raw = rawFeatures(hour, dow, histOcc);
      const z   = applyStandardize(raw, this._fMeans, this._fStds);
      regOcc    = Math.min(1, Math.max(0, dotProduct(z, this._w) + this._bias));
    } else {
      regOcc = histOcc;
    }

    // ── Blend based on bucket confidence ─────────────────────────────────────
    const bCount = bucket?.count ?? 0;
    const alpha  = bCount >= 10 ? 0.70 :
                   bCount >= 5  ? 0.55 :
                   bCount >= 2  ? 0.35 : 0.00;

    const blendedOcc = bOcc != null
      ? alpha * bOcc + (1 - alpha) * regOcc
      : regOcc;

    const expectedPax     = Math.min(cap, Math.max(0, Math.round(blendedOcc * cap)));
    const occupancyPct    = Math.round(blendedOcc * 100);

    const demand_level =
      occupancyPct >= 85 ? "very_high" :
      occupancyPct >= 65 ? "high"      :
      occupancyPct >= 40 ? "moderate"  : "low";

    const confidence =
      bCount >= 10              ? "high"   :
      bCount >= 3 || this._sampleCount >= 50 ? "medium" : "low";

    // ── Peak type ─────────────────────────────────────────────────────────────
    const peak_type =
      hour >= 7  && hour <= 9  ? "morning_rush"  :
      hour >= 12 && hour <= 14 ? "lunch_peak"    :
      hour >= 16 && hour <= 19 ? "evening_rush"  :
      hour >= 21 || hour <= 5  ? "off_peak_night": "off_peak_day";

    // ── Operational recommendation ───────────────────────────────────────────
    const recommendation =
      occupancyPct >= 90 ? "High demand: consider adding an extra service for this slot." :
      occupancyPct >= 70 ? "Elevated demand: ensure full-capacity vehicle is dispatched." :
      occupancyPct <= 20 ? "Low demand: a smaller vehicle may be sufficient."             :
                           "Normal demand: standard service recommended.";

    return {
      expected_passengers: expectedPax,
      capacity:            cap,
      occupancy_pct:       occupancyPct,
      demand_level,
      confidence,
      peak_type,
      recommendation,
      route_id:            Number(routeId),
      departure_time: dt instanceof Date && !isNaN(dt) ? dt.toISOString() : new Date().toISOString(),
      model: {
        bucket_samples:  bCount,
        blend_alpha:     +alpha.toFixed(2),
        historical_avg_occupancy_pct: Math.round(histOcc * 100),
        trained_on:      this._sampleCount,
        training_rmse:   this._rmse != null ? +(this._rmse * 100).toFixed(1) + "% pts" : null,
      },
    };
  }

  /**
   * Forecast demand for every departure slot throughout a full day.
   *
   * @param {number|string} routeId
   * @param {string}        dateStr  – "YYYY-MM-DD" (UTC)
   * @param {number}        [intervalHours=1]  – slot interval in hours
   * @returns {DayForecast}
   */
  forecastDay(routeId, dateStr, intervalHours = 1) {
    const base = new Date(`${dateStr}T00:00:00Z`);
    const schedule = [];
    let peakHour = null, peakPax = -1, totalPax = 0;

    for (let h = 5; h <= 22; h += intervalHours) {
      const dt = new Date(base);
      dt.setUTCHours(h, 0, 0, 0);
      const slot = this.predict(routeId, dt);
      schedule.push({
        hour:             h,
        time_label:       `${String(h).padStart(2,"0")}:00`,
        expected_passengers: slot.expected_passengers,
        capacity:         slot.capacity,
        occupancy_pct:    slot.occupancy_pct,
        demand_level:     slot.demand_level,
        peak_type:        slot.peak_type,
        confidence:       slot.confidence,
      });
      totalPax += slot.expected_passengers;
      if (slot.expected_passengers > peakPax) {
        peakPax  = slot.expected_passengers;
        peakHour = h;
      }
    }

    const avgOcc = schedule.reduce((s, x) => s + x.occupancy_pct, 0) / schedule.length;

    return {
      route_id:          Number(routeId),
      date:              dateStr,
      peak_hour:         peakHour,
      peak_passengers:   peakPax,
      peak_time_label:   peakHour != null ? `${String(peakHour).padStart(2,"0")}:00` : null,
      avg_occupancy_pct: Math.round(avgOcc),
      total_expected_passengers: totalPax,
      slot_count:        schedule.length,
      schedule,
      generated_at:      new Date().toISOString(),
    };
  }
}

export const demandPredictor = new DemandPredictor();
