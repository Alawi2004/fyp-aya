import { sql } from "../db/db.js";

export async function getWalletBalance(pool, userId) {
  const result = await pool.request()
    .input("uid", sql.Int, userId)
    .query("SELECT balance FROM wallets WHERE user_id = @uid");
  return result.recordset[0]?.balance ?? 0;
}
