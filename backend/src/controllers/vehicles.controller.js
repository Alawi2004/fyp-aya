import { poolPromise, sql } from "../db/db.js";

export const createVehicle = async (req, res) => {
  const { plate_number, vehicle_type, capacity, model, status } = req.body;
  const pool = await poolPromise;

  await pool
    .request()
    .input("plate", sql.VarChar, plate_number)
    .input("type", sql.VarChar, vehicle_type)
    .input("capacity", sql.Int, capacity)
    .input("model", sql.VarChar, model)
    .input("status", sql.VarChar, status).query(`
      INSERT INTO vehicles(plate_number,vehicle_type,capacity,model,status)
      VALUES(@plate,@type,@capacity,@model,@status)
    `);

  res.status(201).json({ message: "Vehicle created" });
};

export const getVehicles = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vehicles");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
};

export const getVehicleById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM vehicles WHERE vehicle_id=@id");
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { plate_number, vehicle_type, capacity, model, status } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("plate", sql.VarChar, plate_number)
      .input("type", sql.VarChar, vehicle_type)
      .input("capacity", sql.Int, capacity)
      .input("model", sql.VarChar, model)
      .input("status", sql.VarChar, status)
      .query(
        "UPDATE vehicles SET plate_number=@plate, vehicle_type=@type, capacity=@capacity, model=@model, status=@status WHERE vehicle_id=@id"
      );
    res.json({ message: "Vehicle updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update vehicle" });
  }
};

export const updateVehicleStatus = async (req, res) => {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .input("status", sql.VarChar, req.body.status)
    .query("UPDATE vehicles SET status=@status WHERE vehicle_id=@id");

  res.json({ message: "Vehicle updated" });
};
