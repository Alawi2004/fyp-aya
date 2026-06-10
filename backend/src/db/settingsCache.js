import { poolPromise } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight settings cache — refreshes every 60 seconds.
// Used by the maintenance-mode middleware so it doesn't hit the DB per request.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;

let cache      = null;
let lastLoaded = 0;
let loadPromise = null;

const DEFAULTS = {
  maintenance_mode:         "false",
  maintenance_allowed_ips:  "",
  force_2fa_enabled:        "false",
};

export async function getSetting(key) {
  const map = await _getAll();
  return map[key] ?? DEFAULTS[key] ?? null;
}

export async function isMaintenance() {
  return (await getSetting("maintenance_mode")) === "true";
}

export async function isForce2FA() {
  return (await getSetting("force_2fa_enabled")) === "true";
}

export async function getAllowedIps() {
  const raw = await getSetting("maintenance_allowed_ips");
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function invalidateSettingsCache() {
  cache = null;
  lastLoaded = 0;
}

async function _getAll() {
  const now = Date.now();
  if (cache && now - lastLoaded < CACHE_TTL_MS) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = _load().finally(() => { loadPromise = null; });
  return loadPromise;
}

async function _load() {
  try {
    const pool   = await poolPromise;
    const result = await pool.request().query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('maintenance_mode','maintenance_allowed_ips','force_2fa_enabled')"
    );

    const map = { ...DEFAULTS };
    for (const { setting_key, setting_value } of result.recordset) {
      map[setting_key] = setting_value;
    }

    cache      = map;
    lastLoaded = Date.now();
    return cache;
  } catch {
    // Return defaults if table doesn't exist yet or DB is unavailable
    return DEFAULTS;
  }
}
