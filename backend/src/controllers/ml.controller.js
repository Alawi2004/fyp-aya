/**
 * ML Controller — Yalla Transit
 *
 * Exposes two predictive models:
 *   1. Delay Predictor  — multivariate linear regression on trip_delays history
 *   2. Demand Predictor — hybrid bucket + regression on ticket booking history
 *
 * Both models auto-augment with synthetic Lebanese transit data when the
 * database contains fewer than SYNTHETIC_THRESHOLD records, so the API
 * always returns meaningful predictions even with an empty database.
 */

import { poolPromise } from "../db/db.js";
import { predictor }       from "../ml/delayPredictor.js";
import { demandPredictor } from "../ml/demandPredictor.js";

// ── Internal training helpers ─────────────────────────────────────────────────

async function _loadDelayRows(pool) {
  const r = await pool.request().query(`
    SELECT
      td.delay_minutes,
      t.route_id,
      ISNULL(t.start_time, td.reported_at) AS start_time
    FROM trip_delays td
    LEFT JOIN trips t ON t.trip_id = td.trip_id
    WHERE td.delay_minutes > 0
  `);
  return r.recordset;
}

async function _loadDemandRows(pool) {
  const r = await pool.request().query(`
    SELECT
      t.route_id,
      ISNULL(v.capacity, 40)                                            AS capacity,
      (SELECT COUNT(*) FROM tickets tk
       WHERE tk.trip_id = t.trip_id
         AND tk.status IN ('confirmed','boarded','completed'))           AS passengers,
      t.start_time
    FROM trips t
    LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE t.start_time IS NOT NULL
      AND LOWER(ISNULL(t.status,'')) IN ('completed','ongoing','active')
  `);
  return r.recordset;
}

// ── Delay model ───────────────────────────────────────────────────────────────

/**
 * POST /api/ml/train
 * Re-trains the in-memory delay model from trip_delays history.
 * Admin-only.  Responds with training summary.
 */
export const trainDelayModel = async (req, res) => {
  try {
    const pool = await poolPromise;
    const rows = await _loadDelayRows(pool);
    predictor.train(rows);
    res.json({
      ok:              true,
      model:           "delay_predictor",
      real_rows:       rows.length,
      trained_on:      predictor.sampleCount,
      augmented:       predictor.wasAugmented,
      rmse_minutes:    predictor.rmse   != null ? +predictor.rmse.toFixed(2)   : null,
      mae_minutes:     predictor.mae    != null ? +predictor.mae.toFixed(2)    : null,
      trained_at:      predictor.trainedAt,
    });
  } catch (err) {
    console.error("[ml:delay] train error:", err);
    res.status(500).json({ error: "Delay model training failed.", detail: err.message });
  }
};

/**
 * GET /api/ml/delay-prediction
 * Query params:
 *   route_id        (required) integer
 *   departure_time  (optional) ISO 8601 string, defaults to now
 *
 * Lazy-trains on first call if the model has not been trained yet.
 */
export const predictDelay = async (req, res) => {
  const { route_id, departure_time } = req.query;
  if (!route_id) return res.status(400).json({ error: "route_id is required." });

  const rid = Number(route_id);
  if (!Number.isFinite(rid) || rid <= 0) {
    return res.status(400).json({ error: "route_id must be a positive integer." });
  }

  if (!predictor.isTrained) {
    try {
      const pool = await poolPromise;
      predictor.train(await _loadDelayRows(pool));
    } catch (e) {
      console.warn("[ml:delay] lazy-train failed:", e.message);
    }
  }

  const depTime = departure_time ? new Date(departure_time) : new Date();
  if (departure_time && isNaN(depTime)) {
    return res.status(400).json({ error: "departure_time must be a valid ISO 8601 date-time." });
  }

  res.json(predictor.predict(rid, depTime));
};

// ── Demand model ──────────────────────────────────────────────────────────────

/**
 * POST /api/ml/train-demand
 * Re-trains the demand predictor from ticket booking history.
 * Admin-only.  Responds with training summary.
 */
export const trainDemandModel = async (req, res) => {
  try {
    const pool = await poolPromise;
    const rows = await _loadDemandRows(pool);
    demandPredictor.train(rows);
    res.json({
      ok:           true,
      model:        "demand_predictor",
      real_rows:    rows.length,
      trained_on:   demandPredictor.sampleCount,
      augmented:    demandPredictor.wasAugmented,
      rmse_pct_pts: demandPredictor.rmse != null ? +(demandPredictor.rmse * 100).toFixed(2) : null,
      mae_pct_pts:  demandPredictor.mae  != null ? +(demandPredictor.mae  * 100).toFixed(2) : null,
      trained_at:   demandPredictor.trainedAt,
    });
  } catch (err) {
    console.error("[ml:demand] train error:", err);
    res.status(500).json({ error: "Demand model training failed.", detail: err.message });
  }
};

/**
 * GET /api/ml/demand-forecast
 * Predict passenger demand for one departure slot.
 * Query params:
 *   route_id        (required) integer
 *   departure_time  (optional) ISO 8601, defaults to now
 */
export const predictDemand = async (req, res) => {
  const { route_id, departure_time } = req.query;
  if (!route_id) return res.status(400).json({ error: "route_id is required." });

  const rid = Number(route_id);
  if (!Number.isFinite(rid) || rid <= 0) {
    return res.status(400).json({ error: "route_id must be a positive integer." });
  }

  if (!demandPredictor.isTrained) {
    try {
      const pool = await poolPromise;
      demandPredictor.train(await _loadDemandRows(pool));
    } catch (e) {
      console.warn("[ml:demand] lazy-train failed:", e.message);
    }
  }

  const depTime = departure_time ? new Date(departure_time) : new Date();
  if (departure_time && isNaN(depTime)) {
    return res.status(400).json({ error: "departure_time must be a valid ISO 8601 date-time." });
  }

  res.json(demandPredictor.predict(rid, depTime));
};

/**
 * GET /api/ml/demand-forecast/day
 * Return a full-day demand schedule for a route.
 * Query params:
 *   route_id  (required) integer
 *   date      (required) YYYY-MM-DD
 *   interval  (optional) slot interval in hours (1 or 2), default 1
 */
export const forecastDemandDay = async (req, res) => {
  const { route_id, date, interval } = req.query;
  if (!route_id) return res.status(400).json({ error: "route_id is required." });
  if (!date)     return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format." });
  }

  const rid = Number(route_id);
  if (!Number.isFinite(rid) || rid <= 0) {
    return res.status(400).json({ error: "route_id must be a positive integer." });
  }

  const intervalHours = Math.max(1, Math.min(4, Number(interval) || 1));

  if (!demandPredictor.isTrained) {
    try {
      const pool = await poolPromise;
      demandPredictor.train(await _loadDemandRows(pool));
    } catch (e) {
      console.warn("[ml:demand] lazy-train failed:", e.message);
    }
  }

  res.json(demandPredictor.forecastDay(rid, date, intervalHours));
};

// ── Train-all shortcut ────────────────────────────────────────────────────────

/**
 * POST /api/ml/train-all
 * Re-trains both models in parallel.  Admin-only.
 */
export const trainAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    const [delayRows, demandRows] = await Promise.all([
      _loadDelayRows(pool),
      _loadDemandRows(pool),
    ]);
    predictor.train(delayRows);
    demandPredictor.train(demandRows);
    res.json({
      ok: true,
      delay_model: {
        real_rows:    delayRows.length,
        trained_on:   predictor.sampleCount,
        augmented:    predictor.wasAugmented,
        rmse_minutes: predictor.rmse != null ? +predictor.rmse.toFixed(2) : null,
      },
      demand_model: {
        real_rows:    demandRows.length,
        trained_on:   demandPredictor.sampleCount,
        augmented:    demandPredictor.wasAugmented,
        rmse_pct_pts: demandPredictor.rmse != null ? +(demandPredictor.rmse * 100).toFixed(2) : null,
      },
      trained_at: new Date(),
    });
  } catch (err) {
    console.error("[ml] train-all error:", err);
    res.status(500).json({ error: "Training failed.", detail: err.message });
  }
};

// ── Model status ──────────────────────────────────────────────────────────────

/**
 * GET /api/ml/model-status
 * Returns metadata for both models.
 */
export const modelStatus = (req, res) => {
  res.json({
    delay_predictor:  predictor.describe(),
    demand_predictor: demandPredictor.describe(),
    timestamp: new Date(),
  });
};

// Legacy alias kept for backward compatibility
export const trainModel = trainDelayModel;
