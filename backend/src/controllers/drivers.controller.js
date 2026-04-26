import { poolPromise, sql } from "../db/db.js";

// POST /api/drivers
export const createDriver = async (req, res) => {
  try {
    const { user_id, license_number, hire_date } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("license", sql.VarChar, license_number)
      .input("hire_date", sql.Date, hire_date).query(`
        INSERT INTO drivers(user_id, license_number, hire_date)
        VALUES(@user_id, @license, @hire_date)
      `);

    res.status(201).json({ message: "Driver created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create driver" });
  }
};

// GET /api/drivers
export const getDrivers = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT d.driver_id, u.full_name, u.email, d.license_number, d.hire_date
      FROM drivers d
      JOIN users u ON d.user_id = u.user_id
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
};

// GET /api/drivers/:id
export const getDriverById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT d.driver_id, u.full_name, u.email, d.license_number, d.hire_date
        FROM drivers d
        JOIN users u ON d.user_id = u.user_id
        WHERE d.driver_id=@id
      `);
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch driver" });
  }
};

// PUT /api/drivers/:id
export const updateDriver = async (req, res) => {
  try {
    const { license_number, hire_date } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("license", sql.VarChar, license_number)
      .input("hire_date", sql.Date, hire_date)
      .query(
        "UPDATE drivers SET license_number=@license, hire_date=@hire_date WHERE driver_id=@id"
      );
    res.json({ message: "Driver updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update driver" });
  }
};
