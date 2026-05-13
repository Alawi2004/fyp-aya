import express from "express";
import { poolPromise, sql } from "../db/db.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";
import { refreshPermissionCache } from "../db/permissionCache.js";

const router = express.Router();

// GET /api/roles — list all roles with their permission keys
router.get("/", requireAdminOnly, async (req, res) => {
  try {
    const pool = await poolPromise;
    const roles = await pool.request().query(
      "SELECT role_id, role_key, display_name, description, is_system, is_active FROM roles ORDER BY role_id"
    );
    const perms = await pool.request().query(`
      SELECT r.role_key, p.permission_key, p.module_name, p.action_name
      FROM role_permissions rp
      JOIN roles r       ON r.role_id       = rp.role_id
      JOIN permissions p ON p.permission_id = rp.permission_id
      ORDER BY r.role_key, p.module_name, p.action_name
    `);

    // Attach permission arrays to each role
    const permMap = {};
    for (const p of perms.recordset) {
      (permMap[p.role_key] ??= []).push(p.permission_key);
    }

    res.json(roles.recordset.map(r => ({ ...r, permissions: permMap[r.role_key] ?? [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// GET /api/roles/permissions — list every permission
router.get("/permissions", requireAdminOnly, async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request().query(
      "SELECT permission_id, permission_key, module_name, action_name, description FROM permissions ORDER BY module_name, action_name"
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// PUT /api/roles/:id/permissions — replace a role's entire permission set
// Body: { permissions: ["dashboard.view", "trips.create", ...] }
router.put("/:id/permissions", requireAdminOnly, async (req, res) => {
  const roleId = parseInt(req.params.id, 10);
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: "permissions must be an array of permission_key strings" });
  }

  const pool = await poolPromise;
  const tx   = pool.transaction();
  try {
    await tx.begin();

    // Prevent editing system roles
    const roleRow = await tx.request()
      .input("id", sql.Int, roleId)
      .query("SELECT is_system FROM roles WHERE role_id = @id");
    if (!roleRow.recordset[0]) { await tx.rollback(); return res.status(404).json({ error: "Role not found" }); }
    if (roleRow.recordset[0].is_system) { await tx.rollback(); return res.status(403).json({ error: "System roles cannot be modified" }); }

    // Clear existing
    await tx.request().input("id", sql.Int, roleId)
      .query("DELETE FROM role_permissions WHERE role_id = @id");

    // Insert new set
    if (permissions.length > 0) {
      const permRows = await tx.request().query(`
        SELECT permission_id, permission_key FROM permissions
        WHERE permission_key IN (${permissions.map(k => `'${k.replace(/'/g, "''")}'`).join(",")})
      `);
      for (const p of permRows.recordset) {
        await tx.request()
          .input("rid", sql.Int, roleId)
          .input("pid", sql.Int, p.permission_id)
          .query("INSERT INTO role_permissions(role_id,permission_id) VALUES(@rid,@pid)");
      }
    }

    await tx.commit();

    // Invalidate cache so next request reloads from DB
    await refreshPermissionCache();

    res.json({ message: "Role permissions updated and cache refreshed" });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to update role permissions" });
  }
});

// POST /api/roles — create a new custom role (name, description, display_name)
// Body: { role_key, display_name, description }
// Permissions are set separately via PUT /:id/permissions
router.post("/", requireAdminOnly, async (req, res) => {
  const { role_key, display_name, description } = req.body;
  if (!role_key || !display_name) {
    return res.status(400).json({ error: "role_key and display_name are required" });
  }
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("key",  sql.NVarChar(100), role_key.toLowerCase().replace(/\s+/g, "_"))
      .input("name", sql.NVarChar(200), display_name)
      .input("desc", sql.NVarChar(500), description || null)
      .query(`
        INSERT INTO roles (role_key, display_name, description, is_system, is_active, created_at, updated_at)
        OUTPUT INSERTED.role_id
        VALUES (@key, @name, @desc, 0, 1, GETUTCDATE(), GETUTCDATE())
      `);
    res.status(201).json({ role_id: result.recordset[0].role_id, message: "Role created" });
  } catch (err) {
    console.error(err);
    const msg = err.number === 2627 ? "A role with that key already exists" : "Failed to create role";
    res.status(err.number === 2627 ? 409 : 500).json({ error: msg });
  }
});

// DELETE /api/roles/:id — soft-deactivate a non-system custom role
router.delete("/:id", requireAdminOnly, async (req, res) => {
  const roleId = parseInt(req.params.id, 10);
  try {
    const pool = await poolPromise;
    const row  = await pool.request()
      .input("id", sql.Int, roleId)
      .query("SELECT is_system FROM roles WHERE role_id = @id");

    if (!row.recordset[0])        return res.status(404).json({ error: "Role not found" });
    if (row.recordset[0].is_system) return res.status(403).json({ error: "System roles cannot be deleted" });

    await pool.request().input("id", sql.Int, roleId)
      .query("DELETE FROM role_permissions WHERE role_id = @id");
    await pool.request().input("id", sql.Int, roleId)
      .query("DELETE FROM roles WHERE role_id = @id");

    await refreshPermissionCache();
    res.json({ message: "Role deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete role" });
  }
});

// POST /api/roles/cache/refresh — manual cache bust (admin tool)
router.post("/cache/refresh", requireAdminOnly, async (req, res) => {
  try {
    await refreshPermissionCache();
    res.json({ message: "Permission cache refreshed from DB" });
  } catch (err) {
    res.status(500).json({ error: "Cache refresh failed" });
  }
});

export default router;
