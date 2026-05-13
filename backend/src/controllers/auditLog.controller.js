import { poolPromise, sql } from "../db/db.js";

export const getAuditLogs = async (req, res) => {
  try {
    const pool  = await poolPromise;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { action, entity_type, actor_id, from, to, search } = req.query;

    const request = pool.request()
      .input("limit",  sql.Int, limit)
      .input("offset", sql.Int, offset);

    let where = "WHERE 1=1";
    if (action)      { request.input("action",      sql.NVarChar(100), `%${action}%`);      where += " AND al.action_name LIKE @action"; }
    if (entity_type) { request.input("entity_type", sql.NVarChar(100), entity_type);         where += " AND al.entity_type = @entity_type"; }
    if (actor_id)    { request.input("actor_id",    sql.Int,           parseInt(actor_id));  where += " AND al.actor_user_id = @actor_id"; }
    if (from)        { request.input("from",        sql.Date,          from);                where += " AND CAST(al.created_at AS DATE) >= @from"; }
    if (to)          { request.input("to",          sql.Date,          to);                  where += " AND CAST(al.created_at AS DATE) <= @to"; }
    if (search)      { request.input("search",      sql.NVarChar(200), `%${search}%`);       where += " AND (u.full_name LIKE @search OR al.action_name LIKE @search OR al.entity_type LIKE @search)"; }

    const countRes = await pool.request()
      .query(`SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON u.user_id=al.actor_user_id ${where.replace(/@\w+/g, m => `${m}`)}`);

    // Re-add inputs for the data query
    const dataReq = pool.request()
      .input("limit",  sql.Int, limit)
      .input("offset", sql.Int, offset);
    if (action)      dataReq.input("action",      sql.NVarChar(100), `%${action}%`);
    if (entity_type) dataReq.input("entity_type", sql.NVarChar(100), entity_type);
    if (actor_id)    dataReq.input("actor_id",    sql.Int,           parseInt(actor_id));
    if (from)        dataReq.input("from",        sql.Date,          from);
    if (to)          dataReq.input("to",          sql.Date,          to);
    if (search)      dataReq.input("search",      sql.NVarChar(200), `%${search}%`);

    const dataRes = await dataReq.query(`
      SELECT
        al.audit_log_id, al.action_name, al.entity_type, al.entity_id,
        al.old_values_json, al.new_values_json,
        al.ip_address, al.created_at,
        u.full_name AS actor_name, u.role AS actor_role,
        al.actor_user_id
      FROM audit_logs al
      LEFT JOIN users u ON u.user_id = al.actor_user_id
      ${where}
      ORDER BY al.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({
      total:   countRes.recordset[0]?.total ?? 0,
      page,
      limit,
      data:    dataRes.recordset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
};

// Write to audit log from other controllers
export async function writeAuditLog(pool, { actorUserId, actorRole, actionName, entityType, entityId, oldValues, newValues, req }) {
  try {
    await pool.request()
      .input("actor_user_id",  sql.Int,          actorUserId ?? null)
      .input("actor_role",     sql.NVarChar(50),  actorRole   ?? null)
      .input("action_name",    sql.NVarChar(100), actionName)
      .input("entity_type",    sql.NVarChar(100), entityType)
      .input("entity_id",      sql.NVarChar(100), entityId ? String(entityId) : null)
      .input("old_values_json",sql.NVarChar(sql.MAX), oldValues ? JSON.stringify(oldValues) : null)
      .input("new_values_json",sql.NVarChar(sql.MAX), newValues ? JSON.stringify(newValues) : null)
      .input("ip_address",     sql.NVarChar(64),  req?.ip ?? null)
      .input("user_agent",     sql.NVarChar(500), req?.headers?.["user-agent"]?.slice(0, 500) ?? null)
      .query(`
        INSERT INTO audit_logs(actor_user_id,actor_role,action_name,entity_type,entity_id,old_values_json,new_values_json,ip_address,user_agent)
        VALUES(@actor_user_id,@actor_role,@action_name,@entity_type,@entity_id,@old_values_json,@new_values_json,@ip_address,@user_agent)
      `);
  } catch { /* never break the calling operation */ }
}
