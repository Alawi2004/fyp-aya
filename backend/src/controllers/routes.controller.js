import { poolPromise, sql } from "../db/db.js";
import { ensureRouteTables } from "../db/featureSetup.js";

export const getRoutes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM routes WHERE is_deleted = 0");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routes" });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE routes SET is_deleted = 1 WHERE route_id = @id AND is_deleted = 0");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Route not found" });
    res.json({ message: "Route soft-deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete route" });
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
        SELECT s.*, rs.stop_order
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

// ── Route overlap detection ───────────────────────────────────────────────────

export const checkRouteOverlap = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("route_id", sql.Int, req.params.id)
      .query(`
        SELECT
          r2.route_id,
          r2.route_name,
          r2.start_location,
          r2.end_location,
          COUNT(*) AS shared_stops
        FROM route_stops rs1
        JOIN route_stops rs2
          ON rs1.stop_id = rs2.stop_id AND rs1.route_id != rs2.route_id
        JOIN routes r2
          ON r2.route_id = rs2.route_id
        WHERE rs1.route_id = @route_id
        GROUP BY r2.route_id, r2.route_name, r2.start_location, r2.end_location
        HAVING COUNT(*) >= 2
        ORDER BY shared_stops DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check route overlap" });
  }
};

// ── Update a stop's GPS position ─────────────────────────────────────────────

export const updateStopPosition = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input("id",        sql.Int,          req.params.stop_id)
      .input("latitude",  sql.Decimal(9, 6), latitude)
      .input("longitude", sql.Decimal(9, 6), longitude)
      .query("UPDATE stops SET latitude=@latitude, longitude=@longitude WHERE stop_id=@id");
    res.json({ message: "Stop position updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stop position" });
  }
};

// ── Route waypoints ───────────────────────────────────────────────────────────

export const getWaypoints = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);
    const result = await pool.request()
      .input("route_id", sql.Int, req.params.id)
      .query("SELECT waypoint_id, latitude, longitude, wp_order FROM route_waypoints WHERE route_id=@route_id ORDER BY wp_order");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch waypoints" });
  }
};

export const saveWaypoints = async (req, res) => {
  const routeId = Number(req.params.id);
  const { waypoints } = req.body; // [{ lat, lng }]
  if (!Array.isArray(waypoints)) return res.status(400).json({ error: "waypoints must be an array" });

  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);
    const tx = pool.transaction();
    await tx.begin();

    await tx.request().input("route_id", sql.Int, routeId).query("DELETE FROM route_waypoints WHERE route_id=@route_id");

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      await tx.request()
        .input("route_id",  sql.Int,          routeId)
        .input("latitude",  sql.Decimal(9, 6), wp.lat)
        .input("longitude", sql.Decimal(9, 6), wp.lng)
        .input("wp_order",  sql.Int,           i)
        .query("INSERT INTO route_waypoints(route_id,latitude,longitude,wp_order) VALUES(@route_id,@latitude,@longitude,@wp_order)");
    }

    await tx.commit();
    res.json({ message: "Waypoints saved", count: waypoints.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save waypoints" });
  }
};

// ── Fare zones ────────────────────────────────────────────────────────────────

export const getFareZones = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);

    const zones = await pool.request()
      .input("route_id", sql.Int, req.params.id)
      .query("SELECT zone_id, zone_name, zone_color, base_fare FROM fare_zones WHERE route_id=@route_id ORDER BY zone_id");

    const zoneIds = zones.recordset.map(z => z.zone_id);
    let stopMap = {};

    if (zoneIds.length > 0) {
      const stopRows = await pool.request()
        .input("route_id", sql.Int, req.params.id)
        .query(`
          SELECT fzs.zone_id, s.stop_id, s.stop_name, s.latitude, s.longitude
          FROM fare_zone_stops fzs
          JOIN stops s ON s.stop_id = fzs.stop_id
          WHERE fzs.zone_id IN (
            SELECT zone_id FROM fare_zones WHERE route_id=@route_id
          )
        `);
      for (const row of stopRows.recordset) {
        if (!stopMap[row.zone_id]) stopMap[row.zone_id] = [];
        stopMap[row.zone_id].push({ stop_id: row.stop_id, stop_name: row.stop_name, latitude: row.latitude, longitude: row.longitude });
      }
    }

    const result = zones.recordset.map(z => ({ ...z, stops: stopMap[z.zone_id] || [] }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch fare zones" });
  }
};

export const createFareZone = async (req, res) => {
  const { zone_name, zone_color = "#2563EB", base_fare } = req.body;
  if (!zone_name || base_fare == null) return res.status(400).json({ error: "zone_name and base_fare are required" });

  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);
    const result = await pool.request()
      .input("route_id",   sql.Int,          req.params.id)
      .input("zone_name",  sql.NVarChar(60),  zone_name)
      .input("zone_color", sql.NVarChar(7),   zone_color)
      .input("base_fare",  sql.Decimal(6, 2), base_fare)
      .query("INSERT INTO fare_zones(route_id,zone_name,zone_color,base_fare) OUTPUT INSERTED.zone_id VALUES(@route_id,@zone_name,@zone_color,@base_fare)");
    res.status(201).json({ zone_id: result.recordset[0].zone_id, zone_name, zone_color, base_fare, stops: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create fare zone" });
  }
};

export const updateFareZone = async (req, res) => {
  const { zone_name, zone_color, base_fare } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("zone_id",    sql.Int,          req.params.zoneId)
      .input("route_id",   sql.Int,          req.params.id)
      .input("zone_name",  sql.NVarChar(60),  zone_name)
      .input("zone_color", sql.NVarChar(7),   zone_color)
      .input("base_fare",  sql.Decimal(6, 2), base_fare)
      .query("UPDATE fare_zones SET zone_name=@zone_name, zone_color=@zone_color, base_fare=@base_fare, updated_at=GETUTCDATE() WHERE zone_id=@zone_id AND route_id=@route_id");
    res.json({ message: "Fare zone updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update fare zone" });
  }
};

export const deleteFareZone = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("zone_id",  sql.Int, req.params.zoneId)
      .input("route_id", sql.Int, req.params.id)
      .query("DELETE FROM fare_zones WHERE zone_id=@zone_id AND route_id=@route_id");
    res.json({ message: "Fare zone deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete fare zone" });
  }
};

export const assignStopToZone = async (req, res) => {
  const { stop_id } = req.body;
  if (!stop_id) return res.status(400).json({ error: "stop_id required" });
  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);
    await pool.request()
      .input("zone_id", sql.Int, req.params.zoneId)
      .input("stop_id", sql.Int, stop_id)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM fare_zone_stops WHERE zone_id=@zone_id AND stop_id=@stop_id)
          INSERT INTO fare_zone_stops(zone_id,stop_id) VALUES(@zone_id,@stop_id)
      `);
    res.json({ message: "Stop assigned to zone" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign stop" });
  }
};

export const removeStopFromZone = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("zone_id", sql.Int, req.params.zoneId)
      .input("stop_id", sql.Int, req.params.stopId)
      .query("DELETE FROM fare_zone_stops WHERE zone_id=@zone_id AND stop_id=@stop_id");
    res.json({ message: "Stop removed from zone" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove stop" });
  }
};
