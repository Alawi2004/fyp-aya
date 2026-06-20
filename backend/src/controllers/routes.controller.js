import { poolPromise, sql } from "../db/db.js";
import { ensureRouteTables } from "../db/featureSetup.js";
import { getRouteSegments } from "../modules/eta/hereClient.js";

// GET /api/routes/:id/travel-time?departure_time=HH:MM
// Returns total road travel time for a route using HERE live traffic.
// If departure_time is supplied, also returns the calculated arrival time.
export const getRouteTravelTime = async (req, res) => {
  const routeId = Number(req.params.id);
  if (!routeId) return res.status(400).json({ error: "Invalid route ID" });

  try {
    const pool = await poolPromise;
    const stopsRes = await pool.request()
      .input("route_id", sql.Int, routeId)
      .query(`
        SELECT s.stop_id, s.stop_name,
               CAST(s.latitude  AS FLOAT) AS latitude,
               CAST(s.longitude AS FLOAT) AS longitude,
               rs.stop_order
        FROM   route_stops rs
        JOIN   stops s ON s.stop_id = rs.stop_id
        WHERE  rs.route_id = @route_id
        ORDER  BY rs.stop_order
      `);

    const stops = stopsRes.recordset;
    if (stops.length < 2) {
      return res.status(422).json({ error: "Route needs at least 2 stops to calculate travel time" });
    }

    const segments = await getRouteSegments(stops);
    const durationMin = Math.round(segments.reduce((s, seg) => s + seg.duration_min, 0));
    const source      = segments.every(s => s.source === "here") ? "here" : "fallback";

    let arrivalTime = null;
    const dep = req.query.departure_time; // "HH:MM"
    if (dep && /^\d{2}:\d{2}$/.test(dep)) {
      const [h, m] = dep.split(":").map(Number);
      const totalMin = h * 60 + m + durationMin;
      const ah = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
      const am = String(totalMin % 60).padStart(2, "0");
      arrivalTime = `${ah}:${am}`;
    }

    return res.json({ route_id: routeId, stop_count: stops.length, duration_min: durationMin, arrival_time: arrivalTime, source });
  } catch (err) {
    console.error("Route travel time error:", err);
    return res.status(500).json({ error: "Failed to calculate travel time" });
  }
};

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
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid route id" });
  try {
    const pool = await poolPromise;

    // Block deletion if any trips reference this route
    const tripCheck = await pool.request().input("id", sql.Int, id).query(`
      SELECT COUNT(*) AS trip_count FROM trips WHERE route_id = @id
    `);
    const tripCount = tripCheck.recordset[0]?.trip_count ?? 0;
    if (tripCount > 0) {
      return res.status(409).json({
        error: `This route has ${tripCount} trip${tripCount !== 1 ? "s" : ""} assigned to it. Reassign or delete those trips before removing the route.`,
        trip_count: tripCount,
      });
    }

    // Step 1 — clean up complaints (allow NULL route_id)
    await pool.request().input("id", sql.Int, id).query(`
      IF OBJECT_ID('complaints','U') IS NOT NULL
        UPDATE complaints SET route_id = NULL WHERE route_id = @id;
    `);

    // Step 2 — hard-delete everything else referencing this route
    await pool.request().input("id", sql.Int, id).query(`
      IF OBJECT_ID('user_favorite_routes','U') IS NOT NULL
        DELETE FROM user_favorite_routes WHERE route_id = @id;
      IF OBJECT_ID('geofence_events','U') IS NOT NULL
        DELETE FROM geofence_events WHERE route_id = @id;
      IF OBJECT_ID('fare_zone_stops','U') IS NOT NULL
        DELETE FROM fare_zone_stops
        WHERE zone_id IN (SELECT zone_id FROM fare_zones WHERE route_id = @id);
      IF OBJECT_ID('fare_zones','U') IS NOT NULL
        DELETE FROM fare_zones WHERE route_id = @id;
      IF OBJECT_ID('route_waypoints','U') IS NOT NULL
        DELETE FROM route_waypoints WHERE route_id = @id;
      IF OBJECT_ID('route_stops','U') IS NOT NULL
        DELETE FROM route_stops WHERE route_id = @id;
    `);

    // Step 3 — delete the route itself
    const del = await pool.request().input("id", sql.Int, id)
      .query("DELETE FROM routes WHERE route_id = @id");
    if (del.rowsAffected[0] === 0) return res.status(404).json({ error: "Route not found" });
    res.json({ message: "Route deleted" });
  } catch (err) {
    console.error("[deleteRoute]", err.message);
    res.status(500).json({ error: "Delete failed: " + err.message });
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
    const { route_name, start_location, end_location, is_active } = req.body;
    const pool = await poolPromise;
    const r = pool.request().input("id", sql.Int, req.params.id);
    const sets = [];
    if (route_name    !== undefined) { r.input("route_name",     sql.VarChar, route_name);     sets.push("route_name=@route_name"); }
    if (start_location!== undefined) { r.input("start_location", sql.VarChar, start_location); sets.push("start_location=@start_location"); }
    if (end_location  !== undefined) { r.input("end_location",   sql.VarChar, end_location);   sets.push("end_location=@end_location"); }
    if (is_active     !== undefined) { r.input("is_active",      sql.Bit,     is_active ? 1 : 0); sets.push("is_active=@is_active"); }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    await r.query(`UPDATE routes SET ${sets.join(", ")} WHERE route_id=@id`);
    res.json({ message: "Route updated" });
  } catch (err) {
    console.error("[updateRoute]", err.message);
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

    res.json({ message: "Route created successfully" });
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

export const updateRouteStopOrder = async (req, res) => {
  try {
    const { route_id, stop_id } = req.params;
    const { stop_order } = req.body;
    if (stop_order == null) return res.status(400).json({ error: "stop_order required" });
    const pool = await poolPromise;
    await pool.request()
      .input("route_id",   sql.Int, route_id)
      .input("stop_id",    sql.Int, stop_id)
      .input("stop_order", sql.Int, stop_order)
      .query("UPDATE route_stops SET stop_order=@stop_order WHERE route_id=@route_id AND stop_id=@stop_id");
    res.json({ message: "Stop order updated" });
  } catch (err) {
    console.error("[updateRouteStopOrder]", err.message);
    res.status(500).json({ error: "Failed to update stop order" });
  }
};

export const removeStopFromRoute = async (req, res) => {
  try {
    const { route_id, stop_id } = req.params;
    const pool = await poolPromise;
    await pool.request()
      .input("route_id", sql.Int, route_id)
      .input("stop_id",  sql.Int, stop_id)
      .query("DELETE FROM route_stops WHERE route_id=@route_id AND stop_id=@stop_id");
    res.json({ message: "Stop removed from route" });
  } catch (err) {
    console.error("[removeStopFromRoute]", err.message);
    res.status(500).json({ error: "Failed to remove stop from route" });
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
