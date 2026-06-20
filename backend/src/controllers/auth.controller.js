import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { poolPromise, sql } from "../db/db.js";
import { ensureAuthTables } from "../db/featureSetup.js";
import { sendPasswordResetEmail, sendOTPEmail } from "../services/email.service.js";
import { isForce2FA, getSecuritySettings } from "../db/settingsCache.js";

const TEMP_2FA_TTL         = "5m";
const RESET_TOKEN_TTL_MS   = 60 * 60 * 1000;

const isProd = process.env.NODE_ENV === "production";
const COOKIE_BASE = { httpOnly: true, secure: isProd, sameSite: "strict", path: "/" };

function setCookies(res, accessToken, refreshToken, accessTtlMs, refreshTtlMs) {
  res.cookie("access_token",  accessToken,  { ...COOKIE_BASE, maxAge: accessTtlMs  });
  res.cookie("refresh_token", refreshToken, { ...COOKIE_BASE, maxAge: refreshTtlMs });
}

function clearCookies(res) {
  res.clearCookie("access_token",  { ...COOKIE_BASE });
  res.clearCookie("refresh_token", { ...COOKIE_BASE });
}

const MAX_SESSIONS        = 3;

// ── Token helpers ────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function issueAccessToken(user, ttlSec) {
  return jwt.sign({ user_id: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: ttlSec });
}

function issue2FATempToken(userId) {
  return jwt.sign({ user_id: userId, purpose: "two_fa_pending" }, process.env.JWT_SECRET, { expiresIn: TEMP_2FA_TTL });
}

// Returns { raw, hash, expiresAt }
async function issueRefreshToken(pool, userId, ttlSec) {
  const raw      = crypto.randomBytes(40).toString("hex");
  const hash     = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlSec * 1000);

  await pool.request()
    .input("user_id",    sql.Int,       userId)
    .input("token_hash", sql.NVarChar,  hash)
    .input("expires_at", sql.DateTime2, expiresAt)
    .query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES(@user_id,@token_hash,@expires_at)");

  return { raw, hash, expiresAt };
}

// ── Request helpers ──────────────────────────────────────────────────────────

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function deviceFingerprint(req) {
  const raw = [req.headers["user-agent"] || "", req.headers["accept-language"] || "", req.headers["accept-encoding"] || ""].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function parseDeviceName(ua) {
  if (!ua) return "Unknown Device";
  if (/iPhone/.test(ua))     return "iPhone";
  if (/iPad/.test(ua))       return "iPad";
  if (/Android/.test(ua))    return `Android (${/Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Browser"})`;
  if (/Macintosh/.test(ua))  return `Mac (${/Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Safari"})`;
  if (/Windows/.test(ua))    return `Windows (${/Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Browser"})`;
  if (/Linux/.test(ua))      return "Linux";
  return "Browser";
}

// ── Audit logging ────────────────────────────────────────────────────────────

async function writeLoginAudit(pool, { userId, email, req, success, failureReason }) {
  try {
    await pool.request()
      .input("user_id",           sql.Int,         userId ?? null)
      .input("email_attempted",   sql.NVarChar(120), email)
      .input("ip_address",        sql.NVarChar(64),  getClientIp(req))
      .input("user_agent",        sql.NVarChar(500), req.headers["user-agent"]?.slice(0, 500) ?? null)
      .input("device_fingerprint",sql.NVarChar(64),  deviceFingerprint(req))
      .input("success",           sql.Bit,           success ? 1 : 0)
      .input("failure_reason",    sql.NVarChar(100), failureReason ?? null)
      .query(`
        INSERT INTO login_audit_logs
          (user_id,email_attempted,ip_address,user_agent,device_fingerprint,success,failure_reason)
        VALUES
          (@user_id,@email_attempted,@ip_address,@user_agent,@device_fingerprint,@success,@failure_reason)
      `);
  } catch { /* must never break the auth flow */ }
}

// ── Account lockout ──────────────────────────────────────────────────────────

async function checkLockout(pool, email) {
  const res = await pool.request()
    .input("email", sql.NVarChar(120), email)
    .query("SELECT failed_attempts, locked_until, lockout_count FROM login_lockouts WHERE email=@email");

  const row = res.recordset[0];
  if (!row) return { locked: false };

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const retryMs = new Date(row.locked_until) - Date.now();
    return { locked: true, locked_until: row.locked_until, retry_after_seconds: Math.ceil(retryMs / 1000) };
  }
  return { locked: false };
}

async function recordFailedAttempt(pool, email, maxAttempts, lockoutMinutes) {
  const now = new Date();
  await pool.request()
    .input("email", sql.NVarChar(120), email)
    .input("now",   sql.DateTime2,     now)
    .query(`
      IF EXISTS (SELECT 1 FROM login_lockouts WHERE email=@email)
        UPDATE login_lockouts SET failed_attempts=failed_attempts+1, last_attempt_at=@now WHERE email=@email
      ELSE
        INSERT INTO login_lockouts(email,failed_attempts,last_attempt_at) VALUES(@email,1,@now)
    `);

  const res = await pool.request()
    .input("email", sql.NVarChar(120), email)
    .query("SELECT failed_attempts, lockout_count FROM login_lockouts WHERE email=@email");

  const row = res.recordset[0];
  if (row && row.failed_attempts >= maxAttempts) {
    const durationMs  = lockoutMinutes * 60 * 1000;
    const lockedUntil = new Date(Date.now() + durationMs);

    await pool.request()
      .input("email",         sql.NVarChar(120), email)
      .input("locked_until",  sql.DateTime2,     lockedUntil)
      .input("lockout_count", sql.Int,           row.lockout_count + 1)
      .query("UPDATE login_lockouts SET locked_until=@locked_until, lockout_count=@lockout_count, failed_attempts=0 WHERE email=@email");

    return { just_locked: true, locked_until: lockedUntil, retry_after_seconds: Math.ceil(durationMs / 1000) };
  }
  return { just_locked: false };
}

async function clearLockout(pool, email) {
  await pool.request()
    .input("email", sql.NVarChar(120), email)
    .query(`
      IF EXISTS (SELECT 1 FROM login_lockouts WHERE email=@email)
        UPDATE login_lockouts SET failed_attempts=0, locked_until=NULL WHERE email=@email
    `);
}

// ── Session management ───────────────────────────────────────────────────────

async function createSession(pool, userId, tokenHash, expiresAt, req) {
  const ua = req.headers["user-agent"] || null;
  await pool.request()
    .input("user_id",           sql.Int,          userId)
    .input("token_hash",        sql.NVarChar(64),  tokenHash)
    .input("device_fingerprint",sql.NVarChar(64),  deviceFingerprint(req))
    .input("device_name",       sql.NVarChar(200), parseDeviceName(ua))
    .input("ip_address",        sql.NVarChar(64),  getClientIp(req))
    .input("user_agent",        sql.NVarChar(500), ua?.slice(0, 500) ?? null)
    .input("expires_at",        sql.DateTime2,     expiresAt)
    .query(`
      INSERT INTO user_sessions(user_id,token_hash,device_fingerprint,device_name,ip_address,user_agent,expires_at)
      VALUES(@user_id,@token_hash,@device_fingerprint,@device_name,@ip_address,@user_agent,@expires_at)
    `);
}

async function rotateSession(pool, oldHash, newHash, newExpiresAt) {
  await pool.request()
    .input("old_hash",   sql.NVarChar(64), oldHash)
    .input("new_hash",   sql.NVarChar(64), newHash)
    .input("now",        sql.DateTime2,    new Date())
    .input("expires_at", sql.DateTime2,    newExpiresAt)
    .query("UPDATE user_sessions SET token_hash=@new_hash, last_active_at=@now, expires_at=@expires_at WHERE token_hash=@old_hash");
}

async function revokeTokenHash(pool, hash) {
  const tokenRes = await pool.request()
    .input("token_hash", sql.NVarChar(64), hash)
    .query("SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash=@token_hash");

  const token = tokenRes.recordset[0];

  await pool.request()
    .input("token_hash", sql.NVarChar(64), hash)
    .query("DELETE FROM refresh_tokens WHERE token_hash=@token_hash");

  if (token) {
    await pool.request()
      .input("user_id",    sql.Int,         token.user_id)
      .input("token_hash", sql.NVarChar(64), hash)
      .input("reason",     sql.NVarChar(30), "session_revoked")
      .input("expires_at", sql.DateTime2,    token.expires_at)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM refresh_token_blacklist WHERE token_hash=@token_hash)
          INSERT INTO refresh_token_blacklist(user_id,token_hash,reason,expires_at)
          VALUES(@user_id,@token_hash,@reason,@expires_at)
      `);
  }

  await pool.request()
    .input("token_hash", sql.NVarChar(64), hash)
    .query("DELETE FROM user_sessions WHERE token_hash=@token_hash");
}

async function enforceSessionLimit(pool, userId, currentHash) {
  const res = await pool.request()
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT session_id, token_hash FROM user_sessions
      WHERE user_id=@user_id AND expires_at > GETUTCDATE()
      ORDER BY created_at ASC
    `);

  const sessions = res.recordset;
  if (sessions.length <= MAX_SESSIONS) return;

  const toRevoke = sessions
    .filter(s => s.token_hash !== currentHash)
    .slice(0, sessions.length - MAX_SESSIONS);

  for (const s of toRevoke) {
    await revokeTokenHash(pool, s.token_hash);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Exported controllers
// ═══════════════════════════════════════════════════════════════════════════

// ── Register ─────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    // Never trust the client's role field — always register as passenger.
    const { full_name, email, password, phone, birth_date, gender } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const pool = await poolPromise;

    await pool.request()
      .input("full_name",  sql.VarChar,      full_name)
      .input("email",      sql.VarChar,      email)
      .input("password",   sql.VarChar,      hashed)
      .input("phone",      sql.VarChar,      phone ?? null)
      .input("birth_date", sql.Date,         birth_date ? new Date(birth_date) : null)
      .input("gender",     sql.NVarChar(10), gender ?? null)
      .query(`
        INSERT INTO users(full_name,email,password_hash,phone,birth_date,gender,role)
        VALUES(@full_name,@email,@password,@phone,@birth_date,@gender,'passenger')
      `);

    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error(err);
    // SQL Server duplicate key (unique constraint on email)
    if (err.number === 2627 || err.number === 2601 || (err.message && err.message.includes("duplicate key"))) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
    }
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const { maxAttempts, lockoutMinutes, accessTtlSec, refreshTtlSec } = await getSecuritySettings();

    // 1. Check lockout
    const lockout = await checkLockout(pool, email);
    if (lockout.locked) {
      return res.status(429).json({
        error: "Account temporarily locked due to too many failed attempts.",
        locked_until: lockout.locked_until,
        retry_after_seconds: lockout.retry_after_seconds,
      });
    }

    // 2. Look up user
    const result = await pool.request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM users WHERE email=@email");

    const user = result.recordset[0];

    if (!user) {
      const lock = await recordFailedAttempt(pool, email, maxAttempts, lockoutMinutes);
      await writeLoginAudit(pool, { userId: null, email, req, success: false, failureReason: "user_not_found" });
      if (lock.just_locked) {
        return res.status(429).json({
          error: "Account temporarily locked due to too many failed attempts.",
          locked_until: lock.locked_until,
          retry_after_seconds: lock.retry_after_seconds,
        });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const lock = await recordFailedAttempt(pool, email, maxAttempts, lockoutMinutes);
      await writeLoginAudit(pool, { userId: user.user_id, email, req, success: false, failureReason: "wrong_password" });
      if (lock.just_locked) {
        return res.status(429).json({
          error: "Account temporarily locked due to too many failed attempts.",
          locked_until: lock.locked_until,
          retry_after_seconds: lock.retry_after_seconds,
        });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 4. Clear lockout on success
    await clearLockout(pool, email);

    // 5. Check 2FA
    const totpRow = await pool.request()
      .input("user_id", sql.Int, user.user_id)
      .query("SELECT TOP 1 enabled FROM user_totp WHERE user_id=@user_id");

    const has2FA = totpRow.recordset[0]?.enabled === true;

    if (has2FA) {
      const tempToken = issue2FATempToken(user.user_id);
      await writeLoginAudit(pool, { userId: user.user_id, email, req, success: false, failureReason: "2fa_pending" });
      return res.json({ requires_2fa: true, temp_token: tempToken });
    }

    // 5b. Enforce 2FA if system setting requires it
    const force2fa = await isForce2FA();
    if (force2fa && !has2FA) {
      await writeLoginAudit(pool, { userId: user.user_id, email, req, success: false, failureReason: "2fa_required_not_set_up" });
      return res.status(403).json({
        error:      "Two-factor authentication is required by your organisation.",
        code:       "2FA_REQUIRED",
        setup_hint: "Log in from an allowed IP and set up 2FA via GET /api/auth/2fa/setup.",
      });
    }

    // 6. Issue tokens + create session
    const access_token = issueAccessToken(user, accessTtlSec);
    const { raw: refresh_token, hash: tokenHash, expiresAt } = await issueRefreshToken(pool, user.user_id, refreshTtlSec);

    try {
      await createSession(pool, user.user_id, tokenHash, expiresAt, req);
      await enforceSessionLimit(pool, user.user_id, tokenHash);
    } catch (e) {
      console.error("[auth] session tracking error:", e.message);
    }

    await writeLoginAudit(pool, { userId: user.user_id, email, req, success: true });

    setCookies(res, access_token, refresh_token, accessTtlSec * 1000, refreshTtlSec * 1000);
    const { password_hash, ...safeUser } = user;

    // For driver users, include driver_id so mobile app can use it
    if (safeUser.role === "driver") {
      try {
        const dr = await pool.request()
          .input("uid", sql.Int, safeUser.user_id)
          .query("SELECT driver_id FROM drivers WHERE user_id = @uid");
        safeUser.driver_id = dr.recordset[0]?.driver_id ?? null;
      } catch (_) { safeUser.driver_id = null; }
    }

    // Return tokens in body so mobile clients (no cookie jar) can store & use them directly
    return res.json({ user: safeUser, access_token, refresh_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
};

// ── Verify 2FA ────────────────────────────────────────────────────────────────

export const verify2fa = async (req, res) => {
  const { temp_token, totp_code } = req.body;
  try {
    let payload;
    try { payload = jwt.verify(temp_token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: "Invalid or expired 2FA session" }); }

    if (payload.purpose !== "two_fa_pending") return res.status(401).json({ error: "Invalid token purpose" });

    const pool = await poolPromise;

    const totpRow = await pool.request()
      .input("user_id", sql.Int, payload.user_id)
      .query("SELECT secret, enabled FROM user_totp WHERE user_id=@user_id");

    const totp = totpRow.recordset[0];
    if (!totp || !totp.enabled) return res.status(400).json({ error: "2FA not configured for this account" });

    const valid = speakeasy.totp.verify({ secret: totp.secret, encoding: "base32", token: totp_code, window: 1 });

    if (!valid) {
      const userRow = await pool.request().input("user_id", sql.Int, payload.user_id).query("SELECT email FROM users WHERE user_id=@user_id");
      await writeLoginAudit(pool, { userId: payload.user_id, email: userRow.recordset[0]?.email ?? "", req, success: false, failureReason: "invalid_totp" });
      return res.status(401).json({ error: "Invalid 2FA code" });
    }

    const userRow = await pool.request().input("user_id", sql.Int, payload.user_id).query("SELECT * FROM users WHERE user_id=@user_id");
    const user = userRow.recordset[0];
    if (!user) return res.status(401).json({ error: "User not found" });

    const { accessTtlSec, refreshTtlSec } = await getSecuritySettings();
    const access_token = issueAccessToken(user, accessTtlSec);
    const { raw: refresh_token, hash: tokenHash, expiresAt } = await issueRefreshToken(pool, user.user_id, refreshTtlSec);

    try {
      await createSession(pool, user.user_id, tokenHash, expiresAt, req);
      await enforceSessionLimit(pool, user.user_id, tokenHash);
    } catch (e) {
      console.error("[auth] session tracking error:", e.message);
    }

    await writeLoginAudit(pool, { userId: user.user_id, email: user.email, req, success: true });

    setCookies(res, access_token, refresh_token, accessTtlSec * 1000, refreshTtlSec * 1000);
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "2FA verification failed" });
  }
};

// ── Setup 2FA ─────────────────────────────────────────────────────────────────

export const setup2fa = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool = await poolPromise;

    const userRow = await pool.request().input("user_id", sql.Int, userId).query("SELECT full_name, email FROM users WHERE user_id=@user_id");
    const user = userRow.recordset[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const secretObj = speakeasy.generateSecret({ name: `AyaBus Admin (${user.email})`, issuer: "AyaBus", length: 20 });

    await pool.request()
      .input("user_id", sql.Int,          userId)
      .input("secret",  sql.NVarChar(100), secretObj.base32)
      .query(`
        IF EXISTS (SELECT 1 FROM user_totp WHERE user_id=@user_id)
          UPDATE user_totp SET secret=@secret, enabled=0, verified_at=NULL WHERE user_id=@user_id
        ELSE
          INSERT INTO user_totp(user_id,secret,enabled) VALUES(@user_id,@secret,0)
      `);

    const qrDataUrl = await qrcode.toDataURL(secretObj.otpauth_url);
    return res.json({ secret: secretObj.base32, otpauth_url: secretObj.otpauth_url, qr_code: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "2FA setup failed" });
  }
};

// ── Confirm 2FA ───────────────────────────────────────────────────────────────

export const confirm2fa = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { totp_code } = req.body;
    const pool = await poolPromise;

    const totpRow = await pool.request().input("user_id", sql.Int, userId).query("SELECT secret FROM user_totp WHERE user_id=@user_id");
    const totp = totpRow.recordset[0];
    if (!totp) return res.status(400).json({ error: "Run 2FA setup first" });

    const valid = speakeasy.totp.verify({ secret: totp.secret, encoding: "base32", token: totp_code, window: 1 });
    if (!valid) return res.status(401).json({ error: "Invalid code — try again" });

    await pool.request().input("user_id", sql.Int, userId).query("UPDATE user_totp SET enabled=1, verified_at=GETUTCDATE() WHERE user_id=@user_id");
    return res.json({ message: "2FA enabled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "2FA confirmation failed" });
  }
};

// ── Disable 2FA ───────────────────────────────────────────────────────────────
// Requires the current TOTP code to prove the caller still controls the
// authenticator app — prevents an access-token thief from locking out 2FA.

export const disable2fa = async (req, res) => {
  try {
    const userId     = req.user.user_id;
    const { totp_code } = req.body;
    const pool       = await poolPromise;

    const totpRow = await pool.request()
      .input("user_id", sql.Int, userId)
      .query("SELECT secret, enabled FROM user_totp WHERE user_id=@user_id");

    const totp = totpRow.recordset[0];

    // If 2FA is not enrolled, nothing to disable
    if (!totp || !totp.enabled) {
      return res.status(400).json({ error: "2FA is not enabled on this account" });
    }

    // Verify the submitted TOTP code against the stored secret
    const valid = speakeasy.totp.verify({
      secret:   totp.secret,
      encoding: "base32",
      token:    totp_code,
      window:   1,
    });

    if (!valid) {
      return res.status(401).json({ error: "Invalid authenticator code — 2FA not disabled" });
    }

    await pool.request()
      .input("user_id", sql.Int, userId)
      .query("UPDATE user_totp SET enabled=0, verified_at=NULL WHERE user_id=@user_id");

    return res.json({ message: "2FA disabled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
};

// ── Get 2FA status ────────────────────────────────────────────────────────────

export const get2faStatus = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool = await poolPromise;
    const row = await pool.request().input("user_id", sql.Int, userId).query("SELECT enabled, verified_at FROM user_totp WHERE user_id=@user_id");
    return res.json({ enabled: row.recordset[0]?.enabled === true, verified_at: row.recordset[0]?.verified_at ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get 2FA status" });
  }
};

// ── Login Audit ───────────────────────────────────────────────────────────────

export const getLoginAudit = async (req, res) => {
  try {
    const pool  = await poolPromise;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const result = await pool.request().input("limit", sql.Int, limit).query(`
      SELECT TOP (@limit)
        l.log_id, l.email_attempted, l.ip_address, l.user_agent,
        l.device_fingerprint, l.success, l.failure_reason, l.logged_at,
        u.full_name, u.role
      FROM login_audit_logs l
      LEFT JOIN users u ON u.user_id = l.user_id
      ORDER BY l.logged_at DESC
    `);

    return res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
};

// ── Active Sessions ───────────────────────────────────────────────────────────

export const getSessions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool   = await poolPromise;

    // Identify the current session by matching device fingerprint + active tokens
    const currentFp = deviceFingerprint(req);

    const result = await pool.request().input("user_id", sql.Int, userId).query(`
      SELECT session_id, device_name, device_fingerprint, ip_address, last_active_at, created_at
      FROM user_sessions
      WHERE user_id=@user_id AND expires_at > GETUTCDATE()
      ORDER BY last_active_at DESC
    `);

    const sessions = result.recordset.map(s => ({
      ...s,
      is_current: s.device_fingerprint === currentFp,
    }));

    return res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const userId    = req.user.user_id;
    const sessionId = Number(req.params.id);
    const pool      = await poolPromise;

    const row = await pool.request()
      .input("session_id", sql.Int, sessionId)
      .input("user_id",    sql.Int, userId)
      .query("SELECT token_hash FROM user_sessions WHERE session_id=@session_id AND user_id=@user_id");

    if (!row.recordset[0]) return res.status(404).json({ error: "Session not found" });

    await revokeTokenHash(pool, row.recordset[0].token_hash);
    return res.json({ message: "Session revoked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to revoke session" });
  }
};

export const revokeAllOtherSessions = async (req, res) => {
  try {
    const userId    = req.user.user_id;
    const currentFp = deviceFingerprint(req);
    const pool      = await poolPromise;

    const rows = await pool.request()
      .input("user_id", sql.Int, userId)
      .query("SELECT token_hash, device_fingerprint FROM user_sessions WHERE user_id=@user_id AND expires_at > GETUTCDATE()");

    const others = rows.recordset.filter(s => s.device_fingerprint !== currentFp);
    for (const s of others) await revokeTokenHash(pool, s.token_hash);

    return res.json({ revoked: others.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to revoke sessions" });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const result = await pool.request().input("email", sql.VarChar, email).query("SELECT user_id FROM users WHERE email=@email");
    const user = result.recordset[0];
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    await pool.request().input("user_id", sql.Int, user.user_id)
      .query("UPDATE password_reset_tokens SET used_at=GETUTCDATE() WHERE user_id=@user_id AND used_at IS NULL");

    const raw      = crypto.randomBytes(32).toString("hex");
    const hash     = hashToken(raw);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.request()
      .input("user_id",    sql.Int,         user.user_id)
      .input("token_hash", sql.NVarChar(64), hash)
      .input("expires_at", sql.DateTime2,    expiresAt)
      .query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(@user_id,@token_hash,@expires_at)");

    const adminBase = process.env.ADMIN_BASE_URL || "http://localhost:5173";
    try {
      await sendPasswordResetEmail(email, `${adminBase}?token=${raw}`);
      console.log(`[auth] Password reset email sent to ${email}`);
    } catch (emailErr) {
      console.error("[auth] forgotPassword - SMTP error:", emailErr);
    }

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("[auth] forgotPassword error:", err.message);
    return res.json({ message: "If that email exists, a reset link has been sent." });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const hash   = hashToken(token);
    const result = await pool.request()
      .input("token_hash", sql.NVarChar(64), hash)
      .query("SELECT token_id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash=@token_hash");

    const record = result.recordset[0];
    if (!record)         return res.status(400).json({ error: "Invalid or expired reset token" });
    if (record.used_at)  return res.status(400).json({ error: "Reset token already used" });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: "Reset token has expired" });

    const hashed = await bcrypt.hash(password, 10);

    await pool.request().input("user_id", sql.Int, record.user_id).input("password_hash", sql.VarChar, hashed)
      .query("UPDATE users SET password_hash=@password_hash WHERE user_id=@user_id");

    await pool.request().input("token_id", sql.Int, record.token_id)
      .query("UPDATE password_reset_tokens SET used_at=GETUTCDATE() WHERE token_id=@token_id");

    // Revoke all active refresh tokens & sessions (force re-login everywhere)
    const sessions = await pool.request().input("user_id", sql.Int, record.user_id)
      .query("SELECT token_hash FROM user_sessions WHERE user_id=@user_id");
    for (const s of sessions.recordset) {
      try { await revokeTokenHash(pool, s.token_hash); } catch {}
    }
    await pool.request().input("user_id", sql.Int, record.user_id).query("DELETE FROM refresh_tokens WHERE user_id=@user_id");

    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("[auth] resetPassword error:", err.message);
    res.status(500).json({ error: "Password reset failed: " + err.message });
  }
};

// ── Reset Password via OTP (in-app flow) ─────────────────────────────────────

export const resetPasswordOtp = async (req, res) => {
  const { email, otp, new_password } = req.body;
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const otpResult = await pool.request()
      .input("email", sql.NVarChar(120), email)
      .query("SELECT TOP 1 otp_id, code, expires_at FROM otp_codes WHERE email = @email AND purpose = 'reset_password' ORDER BY created_at DESC");

    const stored = otpResult.recordset[0];
    if (!stored) return res.status(400).json({ error: "No reset code found — request a new one" });

    if (new Date() > new Date(stored.expires_at)) {
      await pool.request().input("otp_id", sql.Int, stored.otp_id).query("DELETE FROM otp_codes WHERE otp_id = @otp_id");
      return res.status(400).json({ error: "Code expired — request a new one" });
    }

    if (stored.code !== String(otp).trim()) {
      return res.status(400).json({ error: "Invalid code" });
    }

    const userResult = await pool.request()
      .input("email", sql.NVarChar(120), email)
      .query("SELECT user_id FROM users WHERE email = @email");

    const user = userResult.recordset[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.request()
      .input("user_id",      sql.Int,     user.user_id)
      .input("password_hash", sql.VarChar, hashed)
      .query("UPDATE users SET password_hash = @password_hash WHERE user_id = @user_id");

    await pool.request().input("otp_id", sql.Int, stored.otp_id).query("DELETE FROM otp_codes WHERE otp_id = @otp_id");
    await pool.request().input("user_id", sql.Int, user.user_id).query("DELETE FROM refresh_tokens WHERE user_id = @user_id");

    return res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("[auth] resetPasswordOtp error:", err.message);
    return res.status(500).json({ error: "Password reset failed. Please try again." });
  }
};

// ── Refresh ───────────────────────────────────────────────────────────────────

export const refresh = async (req, res) => {
  try {
    const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!refresh_token) return res.status(401).json({ error: "Refresh token required" });
    const hash = hashToken(refresh_token);
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const blacklisted = await pool.request().input("token_hash", sql.NVarChar, hash)
      .query("SELECT TOP 1 * FROM refresh_token_blacklist WHERE token_hash=@token_hash");

    if (blacklisted.recordset[0]) {
      if (blacklisted.recordset[0].user_id)
        await pool.request().input("user_id", sql.Int, blacklisted.recordset[0].user_id).query("DELETE FROM refresh_tokens WHERE user_id=@user_id");
      return res.status(401).json({ error: "Refresh token reuse detected or token was revoked" });
    }

    const result = await pool.request().input("token_hash", sql.NVarChar, hash)
      .query("SELECT rt.*, u.role FROM refresh_tokens rt JOIN users u ON u.user_id=rt.user_id WHERE rt.token_hash=@token_hash");

    const record = result.recordset[0];
    if (!record || new Date(record.expires_at) < new Date())
      return res.status(401).json({ error: "Invalid or expired refresh token" });

    await pool.request().input("token_hash", sql.NVarChar, hash).query("DELETE FROM refresh_tokens WHERE token_hash=@token_hash");

    await pool.request()
      .input("user_id",    sql.Int,         record.user_id)
      .input("token_hash", sql.NVarChar,     hash)
      .input("reason",     sql.NVarChar(30), "rotated")
      .input("expires_at", sql.DateTime2,    record.expires_at)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM refresh_token_blacklist WHERE token_hash=@token_hash)
          INSERT INTO refresh_token_blacklist(user_id,token_hash,reason,expires_at)
          VALUES(@user_id,@token_hash,@reason,@expires_at)
      `);

    const { accessTtlSec, refreshTtlSec } = await getSecuritySettings();
    const { raw: new_refresh_token, hash: newHash, expiresAt: newExpiresAt } = await issueRefreshToken(pool, record.user_id, refreshTtlSec);

    try { await rotateSession(pool, hash, newHash, newExpiresAt); } catch {}

    const access_token = issueAccessToken({ user_id: record.user_id, role: record.role }, accessTtlSec);
    setCookies(res, access_token, new_refresh_token, accessTtlSec * 1000, refreshTtlSec * 1000);
    // Return the rotated refresh token in the body too — mobile clients have no
    // cookie jar, and the old token is now blacklisted, so they need this to refresh again later.
    res.json({ ok: true, access_token, refresh_token: new_refresh_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Token refresh failed" });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logout = async (req, res) => {
  try {
    const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!refresh_token) {
      clearCookies(res);
      return res.json({ message: "Logged out" });
    }

    const hash = hashToken(refresh_token);
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    await revokeTokenHash(pool, hash);
    clearCookies(res);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Logout failed" });
  }
};

// ── OTP (email verification for passenger registration & login) ───────────────

export const sendOtp = async (req, res) => {
  const { purpose } = req.body;
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const code      = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const pool = await poolPromise;
    await ensureAuthTables(pool);

    // Replace any existing OTP for this email then insert the fresh one
    await pool.request()
      .input("email", sql.NVarChar(120), email)
      .query("DELETE FROM otp_codes WHERE email = @email");

    await pool.request()
      .input("email",      sql.NVarChar(120), email)
      .input("code",       sql.NVarChar(6),   code)
      .input("purpose",    sql.NVarChar(30),  purpose ?? null)
      .input("expires_at", sql.DateTime2,     expiresAt)
      .query("INSERT INTO otp_codes(email, code, purpose, expires_at) VALUES(@email, @code, @purpose, @expires_at)");

    // Fire-and-forget — don't block the HTTP response waiting on SMTP
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    if (smtpConfigured) {
      sendOTPEmail(email, code)
        .then(() => console.log(`[otp] sent to ${email}`))
        .catch(err => console.error("[otp] email send failed:", err.message));
    } else {
      console.log(`[otp] dev mode — code for ${email}: ${code}`);
    }

    // In dev mode (no SMTP), surface the code directly so the mobile app can
    // display it without needing a real email inbox.
    return res.json({
      message: "Verification code sent",
      ...(!smtpConfigured && { dev_code: code }),
    });
  } catch (err) {
    console.error("[otp] sendOtp error:", err.message);
    return res.status(500).json({ error: "Could not send verification code. Please try again." });
  }
};

export const verifyOtp = async (req, res) => {
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  const code  = req.body.code;
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const result = await pool.request()
      .input("email", sql.NVarChar(120), email)
      .query("SELECT TOP 1 otp_id, code, expires_at FROM otp_codes WHERE email = @email ORDER BY created_at DESC");

    const stored = result.recordset[0];
    if (!stored) return res.status(400).json({ error: "No code found — request a new one" });

    if (new Date() > new Date(stored.expires_at)) {
      await pool.request()
        .input("otp_id", sql.Int, stored.otp_id)
        .query("DELETE FROM otp_codes WHERE otp_id = @otp_id");
      return res.status(400).json({ error: "Code expired — request a new one" });
    }

    if (stored.code !== String(code).trim()) {
      return res.status(400).json({ error: "Invalid code" });
    }

    // Single-use: delete after successful match
    await pool.request()
      .input("otp_id", sql.Int, stored.otp_id)
      .query("DELETE FROM otp_codes WHERE otp_id = @otp_id");

    return res.json({ valid: true });
  } catch (err) {
    console.error("[otp] verifyOtp error:", err.message);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
};

// PUT /api/auth/push-token — store Expo push token for the authenticated user
export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    const pool = await poolPromise;
    await pool.request()
      .input("uid",   sql.Int,          req.user.user_id)
      .input("token", sql.NVarChar(200), token)
      .query("UPDATE users SET push_token = @token WHERE user_id = @uid");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save push token" });
  }
};

// PUT /api/auth/fcm-token — store raw FCM / APNs device token
export const saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    const pool = await poolPromise;
    await pool.request()
      .input("uid",   sql.Int,          req.user.user_id)
      .input("token", sql.NVarChar(300), token)
      .query("UPDATE users SET fcm_token = @token WHERE user_id = @uid");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save FCM token" });
  }
};
