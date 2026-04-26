import { poolPromise, sql } from "../db/db.js";

export const getAllUsers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM users");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserProfile = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM users WHERE user_id=@id");

  res.json(result.recordset[0]);
};

export const updateUserProfile = async (req, res) => {
  const { full_name, phone } = req.body;
  const pool = await poolPromise;

  await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .input("full_name", sql.VarChar, full_name)
    .input("phone", sql.VarChar, phone).query(`
      UPDATE users 
      SET full_name=@full_name, phone=@phone
      WHERE user_id=@id
    `);

  res.json({ message: "Profile updated" });
};

export const getUserTickets = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM tickets WHERE user_id=@id");

  res.json(result.recordset);
};

export const getUserNotifications = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM notifications WHERE user_id=@id");

  res.json(result.recordset);
};
