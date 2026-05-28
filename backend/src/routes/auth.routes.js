import express from "express";
import {
  register, login, verify2fa,
  setup2fa, confirm2fa, disable2fa, get2faStatus,
  getLoginAudit,
  getSessions, revokeSession, revokeAllOtherSessions,
  forgotPassword, resetPassword,
  refresh, logout, savePushToken, saveFcmToken,
  sendOtp, verifyOtp,
} from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, requireAdminOnly } from "../middleware/auth.middleware.js";
import { authLimiter, refreshLimiter, registerLimiter } from "../middleware/rateLimiter.middleware.js";
import {
  registerSchema, loginSchema, refreshSchema,
  verify2faSchema, confirm2faSchema,
  forgotPasswordSchema, resetPasswordSchema,
  disable2faSchema, sendOtpSchema, verifyOtpSchema,
} from "../validators/auth.validators.js";

const router = express.Router();

// ── Public auth ──────────────────────────────────────────────────────────────

router.post("/send-otp",    authLimiter, validate(sendOtpSchema),   sendOtp);
router.post("/verify-otp",  authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login",    authLimiter, validate(loginSchema),    login);
router.post("/verify-2fa", authLimiter, validate(verify2faSchema), verify2fa);
router.post("/refresh",  refreshLimiter, validate(refreshSchema), refresh);
router.post("/logout",   validate(refreshSchema), logout);

// ── Password reset (public, rate-limited) ────────────────────────────────────

router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password",  authLimiter, validate(resetPasswordSchema),  resetPassword);

// ── 2FA management (requires active session) ─────────────────────────────────

router.get( "/2fa/status",   requireAuth, get2faStatus);
router.post("/2fa/setup",    requireAuth, setup2fa);
router.post("/2fa/confirm",  requireAuth, validate(confirm2faSchema), confirm2fa);
router.post("/2fa/disable",  requireAuth, validate(disable2faSchema), disable2fa);

// ── Session management (requires active session) ──────────────────────────────

router.get(   "/sessions",        requireAuth, getSessions);
router.delete("/sessions/others", requireAuth, revokeAllOtherSessions);
router.delete("/sessions/:id",    requireAuth, revokeSession);

// ── Push notification token (any authenticated user) ─────────────────────────

router.put("/push-token", requireAuth, savePushToken);
router.put("/fcm-token",  requireAuth, saveFcmToken);

// ── Login audit (admin only) ──────────────────────────────────────────────────

router.get("/login-audit", requireAdminOnly, getLoginAudit);

export default router;
