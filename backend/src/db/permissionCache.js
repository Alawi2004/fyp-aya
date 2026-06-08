import { poolPromise } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded fallback — mirrors the seeded DB data exactly.
// Used when the DB is unavailable or returns no rows.
// ─────────────────────────────────────────────────────────────────────────────
export const HARDCODED_MATRIX = {
  super_admin:       { "*": { view: true, create: true, edit: true, delete: true } },
  admin:             { "*": { view: true, create: true, edit: true, delete: true } },

  transport_manager: {
    dashboard:     { view: true },
    live:          { view: true, edit: true },
    camera:        { view: true },
    drivers:       { view: true, create: true, edit: true },
    vehicles:      { view: true, create: true, edit: true },
    routes:        { view: true, create: true, edit: true },
    trips:         { view: true, create: true, edit: true, delete: true },
    analytics:     { view: true },
    tickets:       { view: true },
    notifications: { view: true },
    ratings:       { view: true },
    users:         { view: true },
  },

  finance_officer: {
    dashboard:     { view: true },
    analytics:     { view: true },
    tickets:       { view: true, create: true, edit: true },
    wallet:        { view: true, create: true, edit: true },
    ratings:       { view: true },
    users:         { view: true },
  },

  ops_staff: {
    dashboard:     { view: true },
    live:          { view: true },
    trips:         { view: true },
    notifications: { view: true, create: true },
    camera:        { view: true },
    users:         { view: true },
  },

  auditor: {
    dashboard:     { view: true },
    live:          { view: true },
    camera:        { view: true },
    drivers:       { view: true },
    vehicles:      { view: true },
    routes:        { view: true },
    trips:         { view: true },
    analytics:     { view: true },
    tickets:       { view: true },
    notifications: { view: true },
    ratings:       { view: true },
    wallet:        { view: true },
    users:         { view: true },
  },

  it_admin: {
    dashboard:     { view: true },
    users:         { view: true, create: true, edit: true, delete: true },
    vehicles:      { view: true, edit: true },
    live:          { view: true },
    camera:        { view: true },
    notifications: { view: true },
    drivers:       { view: true },
  },

  staff: {
    dashboard:     { view: true },
    live:          { view: true },
    trips:         { view: true },
    notifications: { view: true, create: true },
    camera:        { view: true },
    wallet:        { view: true, create: true, edit: true },
    users:         { view: true },
  },

  driver: {
    trips:         { view: true, edit: true },
    notifications: { view: true },
    ratings:       { view: true },
    live:          { view: true },
  },

  passenger: {
    tickets:       { view: true, create: true },
    wallet:        { view: true },
    notifications: { view: true },
    ratings:       { create: true },
    trips:         { view: true },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache — null means "not yet loaded"
// ─────────────────────────────────────────────────────────────────────────────
let cached = null;
let loadPromise = null;

// ─────────────────────────────────────────────────────────────────────────────
// getMatrix()
// Returns the permission matrix, loading from DB on first call.
// Subsequent calls return the cached object instantly.
// ─────────────────────────────────────────────────────────────────────────────
export async function getMatrix() {
  if (cached) return cached;
  if (loadPromise) return loadPromise;     // deduplicate concurrent first calls
  loadPromise = _loadFromDb().finally(() => { loadPromise = null; });
  return loadPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// refreshPermissionCache()
// Forces a reload from the DB.  Call this after any role/permission update.
// ─────────────────────────────────────────────────────────────────────────────
export async function refreshPermissionCache() {
  cached = null;
  return getMatrix();
}

// ─────────────────────────────────────────────────────────────────────────────
// invalidatePermissionCache()
// Marks the cache stale; next call to getMatrix() will reload from DB.
// ─────────────────────────────────────────────────────────────────────────────
export function invalidatePermissionCache() {
  cached = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal DB load
// ─────────────────────────────────────────────────────────────────────────────
async function _loadFromDb() {
  try {
    const pool   = await poolPromise;
    const result = await pool.request().query(`
      SELECT r.role_key, p.module_name, p.action_name
      FROM   role_permissions rp
      JOIN   roles       r ON r.role_id       = rp.role_id
      JOIN   permissions p ON p.permission_id = rp.permission_id
      WHERE  r.is_active = 1
    `);

    if (result.recordset.length === 0) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("[permissionCache] role_permissions table is empty — seed the DB before starting in production");
      }
      console.warn("[permissionCache] DB returned 0 rows — using hardcoded fallback");
      cached = HARDCODED_MATRIX;
      return cached;
    }

    const matrix = {
      // Wildcard roles always bypass the matrix — keep them explicit
      super_admin: { "*": { view: true, create: true, edit: true, delete: true } },
      admin:       { "*": { view: true, create: true, edit: true, delete: true } },
    };

    for (const { role_key, module_name, action_name } of result.recordset) {
      if (!matrix[role_key])              matrix[role_key]              = {};
      if (!matrix[role_key][module_name]) matrix[role_key][module_name] = {};
      matrix[role_key][module_name][action_name] = true;
    }

    cached = matrix;
    console.log(`[permissionCache] Loaded ${result.recordset.length} permission rows for ${Object.keys(matrix).length} roles`);
    return cached;
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      console.error("[permissionCache] DB load failed in production — refusing to start with hardcoded fallback:", err.message);
      throw err;
    }
    console.error("[permissionCache] DB load failed — using hardcoded fallback:", err.message);
    cached = HARDCODED_MATRIX;
    return cached;
  }
}
