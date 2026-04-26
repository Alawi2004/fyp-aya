import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../db/db.js";

export const register = async (req, res) => {
  try {
    const { full_name, email, password, phone, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const pool = await poolPromise;

    await pool
      .request()
      .input("full_name", sql.VarChar, full_name)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashed)
      .input("phone", sql.VarChar, phone)
      .input("role", sql.VarChar, role).query(`
        INSERT INTO users(full_name,email,password_hash,phone,role)
        VALUES(@full_name,@email,@password,@phone,@role)
      `);

    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query(`SELECT * FROM users WHERE email=@email`);

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
};
