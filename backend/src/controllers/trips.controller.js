import { poolPromise, sql } from "../db/db.js";

export const createTrip = async (req, res) => {
  const pool = await poolPromise;
  const { vehicle_id, driver_id, route_id, start_time, status } = req.body;

  await pool
    .request()
    .input("vehicle_id", sql.Int, vehicle_id)
    .input("driver_id", sql.Int, driver_id)
    .input("route_id", sql.Int, route_id)
    .input("start_time", sql.DateTime, start_time)
    .input("status", sql.VarChar, status).query(`
      INSERT INTO trips(vehicle_id,driver_id,route_id,start_time,status)
      VALUES(@vehicle_id,@driver_id,@route_id,@start_time,@status)
    `);

  res.status(201).json({ message: "Trip created" });
};

export const getTrips = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.trip_id,
        t.status,
        t.start_time,
        r.route_name,
        r.start_location,
        r.end_location,
        du.full_name AS driver_name,
        v.plate_number,
        v.model      AS vehicle_model,
        v.capacity
      FROM trips t
      LEFT JOIN routes r   ON t.route_id   = r.route_id
      LEFT JOIN drivers d  ON t.driver_id  = d.driver_id
      LEFT JOIN users du   ON d.user_id    = du.user_id
      LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
      ORDER BY t.trip_id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trips" });
  }
};

export const getTripById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM trips WHERE trip_id=@id");
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trip" });
  }
};

export const updateTripStatus = async (req, res) => {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .input("status", sql.VarChar, req.body.status)
    .query("UPDATE trips SET status=@status WHERE trip_id=@id");

  res.json({ message: "Trip updated" });
};

export const getTripsByVehicleType = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("p_type", sql.VarChar, req.params.type)
    .execute("get_trips_by_vehicle");

  res.json(result.recordset);
};

export const getPassengerLoad = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().input("id", sql.Int, req.params.id)
    .query(`
      SELECT * FROM view_passenger_load WHERE trip_id=@id
    `);

  res.json(result.recordset[0]);
};
