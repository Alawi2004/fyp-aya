import jwt from "jsonwebtoken";

/**
 * Verifies the JWT Bearer token and attaches the decoded payload to req.user.
 * Responds 401 if missing or invalid.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Requires the authenticated user to have the role 'admin' or 'staff'.
 * Used for shared privileged operations accessible to both roles.
 */
export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!["admin", "staff"].includes(req.user?.role)) {
      return res.status(403).json({
        error: "Forbidden — admin or staff access required",
      });
    }
    next();
  });
};

/**
 * Requires the authenticated user to have ONLY the role 'staff'.
 * Admins are explicitly blocked to enforce hard separation between portals.
 * Used exclusively on /api/staff/* endpoints.
 */
export const requireStaffOnly = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== "staff") {
      return res.status(403).json({
        error: "Forbidden — staff access only",
      });
    }
    next();
  });
};

/**
 * Requires the authenticated user to have ONLY the role 'admin'.
 * Staff members are blocked from admin-exclusive endpoints.
 */
export const requireAdminOnly = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden — admin access only",
      });
    }
    next();
  });
};
