// Idempotent: add staff_top_up_id link column to wallet_transactions so staff
// top-ups surface structured location / reference / processed-by on the
// passenger's transaction history. Backfills existing staff-originated credits
// by matching the embedded transaction reference.
// Run with:  node src/db/migrations/add_tx_staff_link.mjs
import { poolPromise, sql } from "../db.js";

(async () => {
  const pool = await poolPromise;
  console.log("Connected. Ensuring wallet_transactions.staff_top_up_id…");

  const colRes = await pool.request().query(
    `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'wallet_transactions' AND COLUMN_NAME = 'staff_top_up_id'`);

  if (colRes.recordset.length === 0) {
    await pool.request().query(
      `ALTER TABLE wallet_transactions ADD staff_top_up_id INT NULL`);
    console.log("  ✓ added column staff_top_up_id");
  } else {
    console.log("  • staff_top_up_id already exists");
  }

  // Backfill: link existing credit rows to staff_top_ups via the unique
  // transaction_reference embedded in the description ("… Ref: <ref>").
  const back = await pool.request().query(`
    UPDATE wt
    SET staff_top_up_id = st.top_up_id
    FROM wallet_transactions wt
    JOIN staff_top_ups st
      ON st.user_id = wt.user_id
     AND wt.description LIKE '%Ref: ' + st.transaction_reference
    WHERE wt.staff_top_up_id IS NULL AND wt.type = 'credit'
  `);
  console.log(`  ✓ backfilled ${back.rowsAffected[0]} existing credit row(s)`);
  console.log("Done.");
  process.exit(0);
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
