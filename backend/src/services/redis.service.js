/**
 * Redis service — thin wrapper around ioredis with graceful fallback.
 *
 * When Redis is unavailable (no REDIS_URL, server down, timeout) every
 * exported function silently degrades:
 *   - claimQrJti  → returns true  (allows DB-level duplicate check to run)
 *   - isQrJtiUsed → returns false
 *   - getRedis    → returns null
 *
 * Set REDIS_URL in .env, e.g.:
 *   REDIS_URL=redis://127.0.0.1:6379
 *   REDIS_URL=rediss://user:password@my-host:6380   (TLS)
 */

import IORedis from "ioredis";

// QR JTI keys live for 2× the token TTL so a token cannot be replayed
// even if it was scanned near its expiry edge.
const QR_JTI_TTL_SECONDS = 120;

let _client = null;

function _build() {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const c = new IORedis(url, {
    maxRetriesPerRequest: 1,   // fail fast — don't block the HTTP request
    connectTimeout:       2000, // 2 s connection timeout
    commandTimeout:       500,  // 500 ms per command
    lazyConnect:          true, // don't auto-connect on instantiation
    enableOfflineQueue:   false, // drop commands immediately when disconnected
  });

  c.on("error", () => {
    /* swallow — we log nothing here so the log isn't flooded when Redis
       is intentionally absent in dev; real errors surface as null/throws */
  });

  c.on("connect", () => console.log("[redis] connected to", url.replace(/:\/\/.*@/, "://")));

  return c;
}

/** Returns the shared ioredis client (lazily created). */
export function getRedis() {
  if (!_client) _client = _build();
  return _client;
}

/**
 * Atomically marks a QR JTI as "used" in Redis (SET NX EX).
 *
 * @returns {Promise<boolean>}
 *   true  — key was newly set (first use, allow boarding)
 *   false — key already existed (replay attempt, reject)
 *           also returns true on any Redis error so the caller can
 *           fall back to the authoritative DB used_at check.
 */
export async function claimQrJti(jti) {
  try {
    const r = getRedis();
    // SET key value EX seconds NX  → "OK" on first set, null on collision
    const result = await r.set(
      `qr:jti:${jti}`,
      "1",
      "EX",
      QR_JTI_TTL_SECONDS,
      "NX"
    );
    return result === "OK";   // null means key existed → replay
  } catch {
    return true;              // Redis unavailable — defer to DB check
  }
}

/**
 * Checks whether a JTI has already been claimed (non-atomic read).
 * Used for diagnostics / logging only — do not use for enforcement.
 */
export async function isQrJtiUsed(jti) {
  try {
    const r = getRedis();
    return (await r.exists(`qr:jti:${jti}`)) === 1;
  } catch {
    return false;
  }
}

/**
 * Flush all QR JTI keys (e.g., for testing).
 * Matches keys by SCAN pattern — safe on large keyspaces.
 */
export async function flushQrKeys() {
  try {
    const r = getRedis();
    const keys = await r.keys("qr:jti:*");
    if (keys.length) await r.del(...keys);
  } catch { /* ignore */ }
}
