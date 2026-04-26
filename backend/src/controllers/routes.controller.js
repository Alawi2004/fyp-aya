import { poolPromise, sql } from "../db/db.js";

export const getRoutes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM routes");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routes" });
  }
};

export const getRouteById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM routes WHERE route_id=@id");
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch route" });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const { route_name, start_location, end_location } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("route_name", sql.VarChar, route_name)
      .input("start_location", sql.VarChar, start_location)
      .input("end_location", sql.VarChar, end_location)
      .query(
        "UPDATE routes SET route_name=@route_name, start_location=@start_location, end_location=@end_location WHERE route_id=@id"
      );
    res.json({ message: "Route updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update route" });
  }
};

export const createRoute = async (req, res) => {
  try {
    const { route_name, start_location, end_location } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("route_name", sql.VarChar, route_name)
      .input("start_location", sql.VarChar, start_location)
      .input("end_location", sql.VarChar, end_location).query(`
        INSERT INTO routes (route_name, start_location, end_location)
        VALUES (@route_name, @start_location, @end_location)
      `);

    res.json({ message: "✅ Route created successfully" });
  } catch (err) {
    console.error("Create route error:", err);
    res.status(500).json({ error: "Failed to create route" });
  }
};

export const assignStopToRoute = async (req, res) => {
  try {
    const { route_id } = req.params;
    const { stop_id, stop_order } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("route_id", sql.Int, route_id)
      .input("stop_id", sql.Int, stop_id)
      .input("stop_order", sql.Int, stop_order).query(`
        INSERT INTO route_stops (route_id, stop_id, stop_order)
        VALUES (@route_id, @stop_id, @stop_order)
      `);

    res.json({ message: "✅ Stop assigned to route" });
  } catch (err) {
    console.error("Assign stop error:", err);
    res.status(500).json({ error: "Failed to assign stop" });
  }
};

export const getRouteStops = async (req, res) => {
  try {
    const { route_id } = req.params;
    const pool = await poolPromise;

    const result = await pool.request().input("route_id", sql.Int, route_id)
      .query(`
        SELECT s.*
        FROM route_stops rs
        JOIN stops s ON rs.stop_id = s.stop_id
        WHERE rs.route_id = @route_id
        ORDER BY rs.stop_order
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Get route stops error:", err);
    res.status(500).json({ error: "Failed to load stops" });
  }
};
