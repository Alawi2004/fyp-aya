import { poolPromise, sql } from "../db/db.js";

export const getStops = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM stops");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stops" });
  }
};

export const createStop = async (req, res) => {
  try {
    const { stop_name, latitude, longitude } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("stop_name", sql.VarChar, stop_name)
      .input("latitude", sql.Decimal(9, 6), latitude)
      .input("longitude", sql.Decimal(9, 6), longitude).query(`
        INSERT INTO stops (stop_name, latitude, longitude)
        VALUES (@stop_name, @latitude, @longitude)
      `);

    res.json({ message: "✅ Stop created successfully" });
  } catch (err) {
    console.error("Create stop error:", err);
    res.status(500).json({ error: "Failed to create stop" });
  }
};
