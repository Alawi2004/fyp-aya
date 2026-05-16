/**
 * Shared ML utilities for Yalla Transit predictive models.
 *
 * Includes:
 *  - Linear algebra helpers (dot, standardize, inverse-standardize)
 *  - Cyclical time encoding (sin/cos)
 *  - Synthetic Lebanese transit training data generators
 *    Used when the live database has fewer rows than SYNTHETIC_THRESHOLD.
 *    Generated data mirrors realistic Beirut commute patterns.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum real DB rows before synthetic augmentation kicks in */
export const SYNTHETIC_THRESHOLD = 20;

// ── Math helpers ──────────────────────────────────────────────────────────────

export function dotProduct(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Standardise a 2-D matrix column-wise (z-score).
 * Returns the transformed matrix plus the mean/std arrays needed
 * to apply the same transform to future samples at prediction time.
 * Columns with zero variance are left as-is (std defaults to 1).
 *
 * @param {number[][]} X   – n × d feature matrix
 * @returns {{ Xz: number[][], means: number[], stds: number[] }}
 */
export function standardize(X) {
  if (!X.length) return { Xz: [], means: [], stds: [] };
  const n = X.length;
  const d = X[0].length;
  const means = new Array(d).fill(0);
  const stds  = new Array(d).fill(1);

  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    means[j] = sum / n;
  }
  for (let j = 0; j < d; j++) {
    let v = 0;
    for (let i = 0; i < n; i++) v += (X[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(v / n) || 1;
  }

  const Xz = X.map(row => row.map((xi, j) => (xi - means[j]) / stds[j]));
  return { Xz, means, stds };
}

/**
 * Apply a pre-computed standardisation to a single feature vector.
 * Use means/stds from standardize() called during training.
 */
export function applyStandardize(row, means, stds) {
  return row.map((xi, j) => (xi - means[j]) / stds[j]);
}

/**
 * Cyclical encoding for periodic features (hour, month, day-of-week).
 * Prevents the model from treating e.g. hour 23 as far from hour 0.
 *
 * @param {number} value   – raw value (0-based)
 * @param {number} period  – full cycle length (e.g. 24 for hours)
 * @returns {[number, number]}  [sin, cos]
 */
export function cyclical(value, period) {
  const angle = (2 * Math.PI * value) / period;
  return [Math.sin(angle), Math.cos(angle)];
}

// ── Synthetic training data ───────────────────────────────────────────────────
//
// Generates plausible historical data when the live DB is still sparse.
// Patterns derived from typical Beirut urban/intercity bus schedules.

/** Simple LCG pseudo-random with fixed seed for reproducibility */
function SeededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Route-level characteristics used by both synthetic generators.
 *   capacity    – typical bus capacity (seats)
 *   base_delay  – typical non-rush delay (minutes)
 *   rush_extra  – extra delay during rush hours
 *   mech_prob   – probability of mechanical delay per trip
 *   base_occ    – baseline occupancy fraction (off-peak, weekday)
 *   rush_occ    – occupancy fraction during rush hours
 *   wknd_occ    – occupancy fraction on weekends
 */
const ROUTE_PROFILES = [
  { route_id: 1, capacity: 40, base_delay:  8, rush_extra: 14, mech_prob: 0.05, base_occ: 0.55, rush_occ: 0.92, wknd_occ: 0.48 }, // Beirut city centre
  { route_id: 2, capacity: 30, base_delay:  5, rush_extra: 18, mech_prob: 0.03, base_occ: 0.38, rush_occ: 0.97, wknd_occ: 0.30 }, // University / school route
  { route_id: 3, capacity: 50, base_delay: 11, rush_extra: 10, mech_prob: 0.10, base_occ: 0.62, rush_occ: 0.82, wknd_occ: 0.70 }, // Long intercity
  { route_id: 4, capacity: 40, base_delay:  6, rush_extra: 12, mech_prob: 0.04, base_occ: 0.52, rush_occ: 0.88, wknd_occ: 0.42 }, // Airport / highway
  { route_id: 5, capacity: 30, base_delay: 13, rush_extra:  6, mech_prob: 0.08, base_occ: 0.32, rush_occ: 0.68, wknd_occ: 0.62 }, // Coastal / tourism
];

/**
 * Generate synthetic delay records (for DelayPredictor training).
 * Simulates ~70 delay events per route over an 8-week window.
 *
 * @returns {Array<{ delay_minutes, route_id, start_time }>}
 */
export function syntheticDelayRows() {
  const rng       = SeededRng(1337);
  const rows      = [];
  const BASE      = new Date("2025-09-01T00:00:00Z");

  for (let day = 0; day < 56; day++) {
    const dayDate = new Date(BASE);
    dayDate.setUTCDate(BASE.getUTCDate() + day);
    const dow     = dayDate.getUTCDay();           // 0=Sun … 6=Sat
    const isWknd  = dow === 0 || dow === 6;

    for (const p of ROUTE_PROFILES) {
      // ~1.5 delay events per route per day on average
      const events = isWknd ? 1 : Math.round(1 + rng() * 2);
      for (let e = 0; e < events; e++) {
        const hour    = Math.round(5 + rng() * 17);    // 05:00–22:00
        const isRush  = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);

        let delay = p.base_delay * (0.7 + rng() * 0.7); // ±30 % variance
        if (isRush  && !isWknd) delay += p.rush_extra * (0.8 + rng() * 0.5);
        if (isWknd)             delay *= 0.65;
        // Occasional mechanical spike
        if (rng() < p.mech_prob) delay += 15 + rng() * 30;

        delay = Math.max(1, Math.round(delay));

        const dt = new Date(dayDate);
        dt.setUTCHours(hour, Math.floor(rng() * 60), 0, 0);

        rows.push({ delay_minutes: delay, route_id: p.route_id, start_time: dt.toISOString() });
      }
    }
  }
  return rows;
}

/**
 * Generate synthetic demand records (for DemandPredictor training).
 * One record per (route × departure slot) covering an 8-week window.
 *
 * @returns {Array<{ route_id, capacity, passengers, start_time }>}
 */
export function syntheticDemandRows() {
  const rng     = SeededRng(42);
  const rows    = [];
  const BASE    = new Date("2025-09-01T00:00:00Z");
  const HOURS   = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  for (let day = 0; day < 56; day++) {
    const dayDate = new Date(BASE);
    dayDate.setUTCDate(BASE.getUTCDate() + day);
    const dow    = dayDate.getUTCDay();
    const month  = dayDate.getUTCMonth();
    const isWknd = dow === 0 || dow === 6;
    // Schools start Sep (month 8) → higher demand
    const schoolFactor = (month >= 8 && month <= 11) || (month >= 1 && month <= 5) ? 1.1 : 0.85;

    for (const p of ROUTE_PROFILES) {
      for (const h of HOURS) {
        const isMorningRush  = h >= 7  && h <= 9;
        const isLunchPeak    = h >= 12 && h <= 14;
        const isEveningRush  = h >= 16 && h <= 19;
        const isNight        = h >= 21 || h <= 5;

        let targetOcc = isWknd ? p.wknd_occ : p.base_occ;
        if (!isWknd && (isMorningRush || isEveningRush)) targetOcc = p.rush_occ;
        if (!isWknd && isLunchPeak)                       targetOcc = (p.rush_occ + p.base_occ) / 2;
        if (isNight)                                       targetOcc *= 0.4;
        targetOcc *= schoolFactor;

        // ±25 % noise
        const noisy      = targetOcc * (0.75 + rng() * 0.50);
        const passengers = Math.min(p.capacity, Math.max(0, Math.round(noisy * p.capacity)));

        const dt = new Date(dayDate);
        dt.setUTCHours(h, 0, 0, 0);

        rows.push({ route_id: p.route_id, capacity: p.capacity, passengers, start_time: dt.toISOString() });
      }
    }
  }
  return rows;
}

export { ROUTE_PROFILES };
