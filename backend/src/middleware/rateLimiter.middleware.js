import rateLimit from "express-rate-limit";

// ── Auth endpoints ────────────────────────────────────────────────────────────

// Strict limiter for login / password-reset / 2FA — prevents brute-force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many attempts, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP: separate window so testing doesn't exhaust the login limiter
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: "Too many OTP requests, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration: max 5 new accounts per IP per hour
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many registration attempts from this IP, please try again in 1 hour" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token refresh
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Resource mutation endpoints ───────────────────────────────────────────────

// CRUD mutation guard — prevents automated resource exhaustion on write endpoints
export const crudLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Global fallback ───────────────────────────────────────────────────────────

// Applied to every API route — last line of defence against enumeration/DoS
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: "Too many requests, please try again shortly" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/docs"), // don't throttle Swagger UI
});
