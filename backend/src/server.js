import app from "./app.js";
import sql from "mssql";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

app.get("/api/test", (req, res) => {
  res.json({
    status: "success",
    message: "Backend API is working 🚀",
    time: new Date(),
  });
});

// 🔥 List all tables in the database
app.get("/api/db-test", async (req, res) => {
  try {
    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME;
    `);

    res.json({
      success: true,
      tables: result.recordset,
    });
  } catch (error) {
    console.error("DB test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
