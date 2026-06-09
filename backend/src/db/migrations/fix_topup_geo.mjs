// One-off, idempotent migration: ensure top_up_locations has latitude/longitude
// columns and backfill coordinates for the known seeded locations.
// Safe to run multiple times. Run with:  node src/db/migrations/fix_topup_geo.mjs
import { poolPromise, sql } from "../db.js";

const COORDS = {
  "Riad El Solh Transit Hub":      [33.895900, 35.504700],
  "Hamra Customer Service Centre": [33.895900, 35.478400],
  "Dora Terminal Office":          [33.871400, 35.546900],
  "Jounieh Service Point":         [33.980800, 35.617800],
  "Antelias Agent Counter":        [33.918100, 35.596900],
  "Airport Transit Kiosk":         [33.820900, 35.488400],
};

async function columnExists(pool, table, column) {
  const r = await pool.request()
    .input("t", sql.NVarChar, table)
    .input("c", sql.NVarChar, column)
    .query(`SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @t AND COLUMN_NAME = @c`);
  return r.recordset.length > 0;
}

(async () => {
  const pool = await poolPromise;
  console.log("Connected. Checking top_up_locations schema…");

  for (const col of ["latitude", "longitude"]) {
    if (await columnExists(pool, "top_up_locations", col)) {
      console.log(`  • ${col} already exists`);
    } else {
      await pool.request().query(`ALTER TABLE top_up_locations ADD ${col} DECIMAL(9,6) NULL`);
      console.log(`  ✓ added column ${col}`);
    }
  }

  let updated = 0;
  for (const [name, [lat, lng]] of Object.entries(COORDS)) {
    const r = await pool.request()
      .input("name", sql.NVarChar(255), name)
      .input("lat",  sql.Decimal(9, 6), lat)
      .input("lng",  sql.Decimal(9, 6), lng)
      .query(`UPDATE top_up_locations
              SET latitude = @lat, longitude = @lng
              WHERE name = @name AND (latitude IS NULL OR longitude IS NULL)`);
    updated += r.rowsAffected[0];
  }
  console.log(`  ✓ backfilled coordinates for ${updated} location(s)`);

  const check = await pool.request().query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) AS with_coords
     FROM top_up_locations WHERE is_active = 1`);
  console.log("  Result:", check.recordset[0]);
  console.log("Done.");
  process.exit(0);
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
