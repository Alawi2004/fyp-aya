import { isMaintenance, getAllowedIps } from "../db/settingsCache.js";

// Passthrough paths — always allowed even during maintenance
const PASSTHROUGH_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/settings",  // so admins can turn maintenance off
  "/api/docs",
  "/",              // health check
];

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return fwd ? fwd.split(",")[0].trim() : (req.ip || req.socket?.remoteAddress || "");
}

export const maintenanceModeMiddleware = async (req, res, next) => {
  try {
    const active = await isMaintenance();
    if (!active) return next();

    // Always pass through auth + health + settings
    const path = req.path;
    if (PASSTHROUGH_PREFIXES.some(p => path.startsWith(p))) return next();

    // Pass through allowed IPs
    const allowedIps = await getAllowedIps();
    if (allowedIps.length > 0) {
      const clientIp = getClientIp(req);
      if (allowedIps.includes(clientIp)) return next();
    }

    return res.status(503).json({
      error:   "Service temporarily unavailable",
      message: "The system is currently in maintenance mode. Please try again later.",
      code:    "MAINTENANCE_MODE",
    });
  } catch {
    // Never block a request if the middleware itself errors
    next();
  }
};
