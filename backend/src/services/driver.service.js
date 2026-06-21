import { sql } from "../db/db.js";

export async function getDriverIdByUserId(pool, userId) {
  const result = await pool.request()
    .input("uid", sql.Int, userId)
    .query("SELECT driver_id FROM drivers WHERE user_id = @uid");
  return result.recordset[0]?.driver_id ?? null;
}
