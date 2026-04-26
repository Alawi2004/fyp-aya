import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.SQL_CONNECTION_STRING;

if (!connectionString) {
  console.error("❌ SQL_CONNECTION_STRING is missing in .env");
  process.exit(1);
}

let _pool = null;

async function connectWithRetry(retries = 5, delayMs = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const pool = await sql.connect(connectionString);
      console.log("✅ Azure SQL Database connected successfully");
      _pool = pool;
      return pool;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i}/${retries} failed: ${err.message}`);
      if (i < retries) {
        console.log(`   Retrying in ${delayMs / 1000}s…`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  console.error("❌ All connection attempts failed. Server will continue without DB.");
  console.error("   👉 Fix: add your IP to the Azure SQL firewall at portal.azure.com");
  return null;
}

// Start connecting in the background — server stays alive regardless
const poolPromise = connectWithRetry();

export { sql, poolPromise };
