import { poolPromise, sql } from "../db/db.js";
import { predictor } from "../ml/delayPredictor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal: load training rows from DB and fit the model.
// Reads from trip_delays joined with trips to get route_id + start_time.
// ─────────────────────────────────────────────────────────────────────────────
async function _trainFromDb(pool) {
  const result = await pool.request().query(`
    SELECT
      td.delay_minutes,
      t.route_id,
      ISNULL(t.start_time, td.reported_at) AS start_time
    FROM trip_delays td
    LEFT JOIN trips t ON t.trip_id = td.trip_id
    WHERE td.delay_minutes > 0
  `);

  const rows = result.recordset;
  if (rows.length === 0) return { trained: false, reason: "no_data" };

  predictor.train(rows);
  return {
    trained:      true,
    sample_count: rows.length,
    trained_at:   predictor._trainedAt,
    rmse:         predictor._rmse,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ml/train
// Admin-only: re-trains the in-memory model from the full trip_delays history.
// Auto-invoked on first prediction if the model has not been trained yet.
// ─────────────────────────────────────────────────────────────────────────────
export const trainModel = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await _trainFromDb(pool);
    res.json(result);
  } catch (err) {
    console.error("[ml] train error:", err);
    res.status(500).json({ error: "Training failed", detail: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ml/delay-prediction?route_id=X&departure_time=ISO
// Returns a delay risk estimate for the given route + departure window.
// If the model hasn't been trained yet, triggers a lazy training run first.
// ─────────────────────────────────────────────────────────────────────────────
export const predictDelay = async (req, res) => {
  const { route_id, departure_time } = req.query;

  if (!route_id) {
    return res.status(400).json({ error: "route_id is required" });
  }

  // Lazy-train on first request
  if (!predictor.isTrained) {
    try {
      const pool = await poolPromise;
      await _trainFromDb(pool);
    } catch (err) {
      console.warn("[ml] lazy-train failed:", err.message);
      // Proceed anyway — predictor returns route historical avg as fallback
    }
  }

  const depTime = departure_time ?? new Date().toISOString();
  const prediction = predictor.predict(Number(route_id), depTime);
  res.json(prediction);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ml/model-status
// Returns current model metadata (training samples, RMSE, trained_at).
// ─────────────────────────────────────────────────────────────────────────────
export const modelStatus = (req, res) => {
  res.json({
    trained:        predictor.isTrained,
    trained_at:     predictor._trainedAt,
    trained_on:     predictor._sampleCount,
    training_rmse:  predictor._rmse ? +predictor._rmse.toFixed(2) : null,
    feature_count:  7,
    algorithm:      "multivariate_linear_regression",
    regularisation: "L2 (ridge)",
  });
};
