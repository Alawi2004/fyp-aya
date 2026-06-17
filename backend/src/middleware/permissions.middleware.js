import { requireAuth } from "./auth.middleware.js";
import { getMatrix, HARDCODED_MATRIX, invalidatePermissionCache, refreshPermissionCache } from "../db/permissionCache.js";

// Re-export for any code that still references PERMISSION_MATRIX directly
export { HARDCODED_MATRIX as PERMISSION_MATRIX, invalidatePermissionCache, refreshPermissionCache };

/**
 * Middleware factory — checks that the authenticated user's role
 * has the given action on the given module.
 *
 * Permissions are loaded from the DB on first use and cached in memory.
 * Call refreshPermissionCache() after any role/permission change.
 *
 * Usage:
 *   router.get("/", requirePermission("users", "view"), getAllUsers);
 *   router.post("/", requirePermission("users", "create"), createUser);
 *   router.delete("/:id", requirePermission("users", "delete"), deleteUser);
 */
export const requirePermission = (module, action) => (req, res, next) => {
  requireAuth(req, res, async () => {
    const role = req.user?.role;

    // admin always bypasses the matrix
    if (role === "admin") return next();

    let matrix;
    try {
      matrix = await getMatrix();
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ error: "Permission service unavailable" });
      }
      matrix = HARDCODED_MATRIX;
    }

    const rolePerms = matrix[role];
    if (!rolePerms) {
      return res.status(403).json({
        error:  "Forbidden",
        detail: `Role '${role}' is not recognised in the permission matrix`,
      });
    }

    // Wildcard module check first, then specific module
    const modulePerms = rolePerms["*"] ?? rolePerms[module];
    if (!modulePerms?.[action]) {
      return res.status(403).json({
        error:    "Forbidden",
        detail:   `Role '${role}' does not have '${action}' permission on '${module}'`,
        required: { module, action },
      });
    }

    next();
  });
};

/**
 * Requires the user to have at least one of the supplied roles.
 */
export const requireRole = (...roles) => (req, res, next) => {
  requireAuth(req, res, () => {
    if (roles.includes(req.user?.role)) return next();
    return res.status(403).json({
      error:  "Forbidden",
      detail: `Endpoint requires one of: ${roles.join(", ")}`,
    });
  });
};
