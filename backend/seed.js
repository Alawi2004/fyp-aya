/**
 * Database seeder — runs seed_azure.sql against the Azure SQL database.
 * Usage: node seed.js  (from inside the backend/ directory)
 */
import sql from "mssql";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.resolve(__dirname, "../seed_azure.sql");

const connectionString = process.env.SQL_CONNECTION_STRING;
if (!connectionString) {
  console.error("❌ SQL_CONNECTION_STRING missing in .env");
  process.exit(1);
}

async function run() {
  console.log("Connecting to Azure SQL…");
  const pool = new sql.ConnectionPool(connectionString);
  await pool.connect();
  console.log("✅ Connected\n");

  const script = fs.readFileSync(SEED_FILE, "utf8");

  // Split on the dashed comment section separators in the seed file.
  // Each section contains exactly one PRINT + one MERGE/INSERT block.
  const batches = script
    .split(/^-- ─{10,}/m)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  console.log(`Running ${batches.length} sections from seed_azure.sql…\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const printMatch = batch.match(/^PRINT\s+'(.+?)'/im);
    const label = printMatch ? printMatch[1] : `section ${i + 1}`;
    process.stdout.write(`  [${String(i + 1).padStart(2)}] ${label}\n`);
    try {
      await pool.request().query(batch);
      ok++;
    } catch (err) {
      console.error(`       ❌ ${err.message}`);
      console.error(`          SQL: ${batch.slice(0, 300).replace(/\n/g, " ")}…`);
      failed++;
    }
  }

  await pool.close();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Done — ${ok} batches succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
