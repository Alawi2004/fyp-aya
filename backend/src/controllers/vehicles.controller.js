import { poolPromise, sql } from "../db/db.js";
import fs from "fs";
import path from "path";
import { UPLOAD_BASE_URL, UPLOAD_ABS_DIR } from "../middleware/upload.middleware.js";

export const createVehicle = async (req, res) => {
  try {
    const { plate_number, vehicle_type, capacity, model, status } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input("plate",    sql.VarChar, plate_number)
      .input("type",     sql.VarChar, vehicle_type)
      .input("capacity", sql.Int,     capacity)
      .input("model",    sql.VarChar, model)
      .input("status",   sql.VarChar, status)
      .query("INSERT INTO vehicles(plate_number,vehicle_type,capacity,model,status) VALUES(@plate,@type,@capacity,@model,@status)");
    res.status(201).json({ message: "Vehicle created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
};

export const getVehicles = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(200, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const { search, status, type } = req.query;

    const build = () => {
      const r = pool.request()
        .input("limit",  sql.Int, limit)
        .input("offset", sql.Int, offset);
      let where = "WHERE status != 'deleted'";
      if (search) { r.input("search", sql.NVarChar(200), `%${search}%`); where += " AND (plate_number LIKE @search OR model LIKE @search)"; }
      if (status) { r.input("status", sql.NVarChar(50),  status);        where += " AND status = @status"; }
      if (type)   { r.input("type",   sql.NVarChar(50),  type);          where += " AND vehicle_type = @type"; }
      return { r, where };
    };

    const { r: cr, where } = build();
    const countRes = await cr.query(`SELECT COUNT(*) AS total FROM vehicles ${where}`);

    const { r: dr } = build();
    const dataRes  = await dr.query(`
      SELECT * FROM vehicles ${where}
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({ total: countRes.recordset[0].total, page, limit, data: dataRes.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE vehicles SET status = 'deleted' WHERE vehicle_id = @id AND status != 'deleted'");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ message: "Vehicle soft-deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete vehicle" });
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
  try {
    const pool = await poolPromise;
    await pool.request()
      .input("id",     sql.Int,     req.params.id)
      .input("status", sql.VarChar, req.body.status)
      .query("UPDATE vehicles SET status=@status WHERE vehicle_id=@id");
    res.json({ message: "Vehicle updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update vehicle status" });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles/maintenance             ← ADMIN
// Returns all maintenance records joined with vehicle plate_number.
// Optional filter: ?plate=BUS-01
// ─────────────────────────────────────────────────────────────────────────────
export const getMaintenanceLog = async (req, res) => {
  try {
    const pool    = await poolPromise;
    const request = pool.request();
    let where = "WHERE 1=1";

    if (req.query.plate) {
      request.input("plate", sql.NVarChar(50), req.query.plate);
      where += " AND v.plate_number = @plate";
    }

    const result = await request.query(`
      SELECT
        m.record_id                                        AS id,
        v.plate_number                                     AS plate,
        CONVERT(VARCHAR(10), m.service_date, 23)          AS date,
        m.service_type                                     AS type,
        m.mechanic,
        m.workshop,
        CAST(m.cost AS FLOAT)                             AS cost,
        m.odometer_km                                      AS odometer,
        m.notes,
        CONVERT(VARCHAR(10), m.next_service_date, 23)     AS next_service,
        m.created_at
      FROM vehicle_maintenance_records m
      JOIN vehicles v ON v.vehicle_id = m.vehicle_id
      ${where}
      ORDER BY m.service_date DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch maintenance log" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehicles/maintenance            ← ADMIN
// Body: { plate, date, type, mechanic, workshop?, cost?, odometer?, notes?, next_service? }
// ─────────────────────────────────────────────────────────────────────────────
export const addMaintenanceRecord = async (req, res) => {
  const { plate, date, type, mechanic, workshop, cost, odometer, notes, next_service } = req.body;

  if (!plate || !date || !type || !mechanic) {
    return res.status(400).json({ error: "plate, date, type, and mechanic are required" });
  }

  try {
    const pool = await poolPromise;

    const vRes = await pool.request()
      .input("plate", sql.NVarChar(50), plate)
      .query("SELECT vehicle_id FROM vehicles WHERE plate_number = @plate");

    if (!vRes.recordset[0]) return res.status(404).json({ error: `Vehicle with plate '${plate}' not found` });
    const vehicleId = vRes.recordset[0].vehicle_id;

    const ins = await pool.request()
      .input("vid",     sql.Int,           vehicleId)
      .input("date",    sql.Date,          date)
      .input("type",    sql.NVarChar(100), type)
      .input("mech",    sql.NVarChar(200), mechanic)
      .input("shop",    sql.NVarChar(200), workshop || null)
      .input("cost",    sql.Decimal(10,2), cost     ? parseFloat(cost)   : null)
      .input("odo",     sql.Int,           odometer ? parseInt(odometer) : null)
      .input("notes",   sql.NVarChar(500), notes    || null)
      .input("next",    sql.Date,          next_service || null)
      .query(`
        INSERT INTO vehicle_maintenance_records
          (vehicle_id, service_date, service_type, mechanic, workshop, cost, odometer_km, notes, next_service_date)
        OUTPUT INSERTED.record_id
        VALUES (@vid, @date, @type, @mech, @shop, @cost, @odo, @notes, @next)
      `);

    res.status(201).json({ record_id: ins.recordset[0].record_id, message: "Maintenance record added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add maintenance record" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/vehicles/maintenance/:id         ← ADMIN
// Body: any subset of { date, type, mechanic, workshop, cost, odometer, notes, next_service }
// ─────────────────────────────────────────────────────────────────────────────
export const updateMaintenanceRecord = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { date, type, mechanic, workshop, cost, odometer, notes, next_service } = req.body;

  const sets  = [];
  const req2  = (await poolPromise).request().input("id", sql.Int, id);

  if (date)         { req2.input("date",  sql.Date,          date);                         sets.push("service_date = @date"); }
  if (type)         { req2.input("type",  sql.NVarChar(100), type);                         sets.push("service_type = @type"); }
  if (mechanic)     { req2.input("mech",  sql.NVarChar(200), mechanic);                     sets.push("mechanic = @mech"); }
  if (workshop !== undefined) { req2.input("shop", sql.NVarChar(200), workshop || null);    sets.push("workshop = @shop"); }
  if (cost !== undefined)     { req2.input("cost", sql.Decimal(10,2), cost ? parseFloat(cost) : null); sets.push("cost = @cost"); }
  if (odometer !== undefined) { req2.input("odo",  sql.Int, odometer ? parseInt(odometer) : null);     sets.push("odometer_km = @odo"); }
  if (notes !== undefined)    { req2.input("notes", sql.NVarChar(500), notes || null);      sets.push("notes = @notes"); }
  if (next_service !== undefined) { req2.input("next", sql.Date, next_service || null);     sets.push("next_service_date = @next"); }

  if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const result = await req2.query(
      `UPDATE vehicle_maintenance_records SET ${sets.join(", ")} WHERE record_id = @id`
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Maintenance record updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update maintenance record" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles/fuel                    ← ADMIN
// Returns all fuel records. Optional: ?plate=BUS-01
// ─────────────────────────────────────────────────────────────────────────────
export const getFuelLog = async (req, res) => {
  try {
    const pool    = await poolPromise;
    const request = pool.request();
    let where = "WHERE 1=1";

    if (req.query.plate) {
      request.input("plate", sql.NVarChar(50), req.query.plate);
      where += " AND v.plate_number = @plate";
    }

    const result = await request.query(`
      SELECT
        f.fuel_id                                     AS id,
        v.plate_number                                AS plate,
        CONVERT(VARCHAR(10), f.fuel_date, 23)        AS date,
        f.station,
        CAST(f.liters AS FLOAT)                       AS liters,
        CAST(f.cost   AS FLOAT)                       AS cost,
        f.odometer_km                                  AS odometer,
        f.notes,
        f.created_at
      FROM vehicle_fuel_records f
      JOIN vehicles v ON v.vehicle_id = f.vehicle_id
      ${where}
      ORDER BY f.fuel_date DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch fuel log" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehicles/fuel                   ← ADMIN
// Body: { plate, date, liters, cost?, odometer, station?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
export const addFuelRecord = async (req, res) => {
  const { plate, date, liters, cost, odometer, station, notes } = req.body;

  if (!plate || !date || !liters || !odometer) {
    return res.status(400).json({ error: "plate, date, liters, and odometer are required" });
  }

  try {
    const pool = await poolPromise;

    const vRes = await pool.request()
      .input("plate", sql.NVarChar(50), plate)
      .query("SELECT vehicle_id FROM vehicles WHERE plate_number = @plate");

    if (!vRes.recordset[0]) return res.status(404).json({ error: `Vehicle '${plate}' not found` });
    const vehicleId = vRes.recordset[0].vehicle_id;

    const ins = await pool.request()
      .input("vid",     sql.Int,           vehicleId)
      .input("date",    sql.Date,          date)
      .input("liters",  sql.Decimal(8,2),  parseFloat(liters))
      .input("cost",    sql.Decimal(10,2), cost    ? parseFloat(cost)   : null)
      .input("odo",     sql.Int,           parseInt(odometer))
      .input("station", sql.NVarChar(200), station || null)
      .input("notes",   sql.NVarChar(500), notes   || null)
      .query(`
        INSERT INTO vehicle_fuel_records
          (vehicle_id, fuel_date, liters, cost, odometer_km, station, notes)
        OUTPUT INSERTED.fuel_id
        VALUES (@vid, @date, @liters, @cost, @odo, @station, @notes)
      `);

    res.status(201).json({ fuel_id: ins.recordset[0].fuel_id, message: "Fuel record added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add fuel record" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles/:id/fuel                ← ADMIN
// Fuel history for a single vehicle (by vehicle_id).
// ─────────────────────────────────────────────────────────────────────────────
export const getVehicleFuel = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("vid", sql.Int, parseInt(req.params.id))
      .query(`
        SELECT
          f.fuel_id                                    AS id,
          v.plate_number                               AS plate,
          CONVERT(VARCHAR(10), f.fuel_date, 23)       AS date,
          f.station,
          CAST(f.liters AS FLOAT)                      AS liters,
          CAST(f.cost   AS FLOAT)                      AS cost,
          f.odometer_km                                 AS odometer,
          f.notes
        FROM vehicle_fuel_records f
        JOIN vehicles v ON v.vehicle_id = f.vehicle_id
        WHERE f.vehicle_id = @vid
        ORDER BY f.fuel_date DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch vehicle fuel log" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vehicles/:id/photos             ← ADMIN ONLY
// Accepts multipart/form-data with field "photo" (image) and "slot" (string).
// Stores file to disk, returns the public URL.
// To migrate to Azure Blob: swap the multer storage in upload.middleware.js.
// ─────────────────────────────────────────────────────────────────────────────
export const uploadVehiclePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file received" });

    const slot      = req.body.slot || "photo";
    const filename  = req.file.filename;
    const publicUrl = `${UPLOAD_BASE_URL}/${filename}`;

    res.status(201).json({
      url:      publicUrl,
      filename,
      slot,
      message:  "Photo uploaded successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Photo upload failed" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles/:id/photos              ← ADMIN ONLY
// Lists uploaded photos for a vehicle (scans the upload directory by prefix).
// ─────────────────────────────────────────────────────────────────────────────
export const getVehiclePhotos = async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const prefix    = `vehicle-${vehicleId}-`;

    const files = fs.existsSync(UPLOAD_ABS_DIR)
      ? fs.readdirSync(UPLOAD_ABS_DIR).filter(f => f.startsWith(prefix))
      : [];

    const photos = files.map(f => {
      // filename: vehicle-{id}-{slot}-{ts}.ext
      const parts = f.replace(/\.[^.]+$/, "").split("-");
      const slot  = parts.slice(2, -1).join("-"); // everything between id and timestamp
      return {
        filename: f,
        slot,
        url:  `${UPLOAD_BASE_URL}/${f}`,
      };
    });

    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list vehicle photos" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/vehicles/:id/photos/:filename ← ADMIN ONLY
// Removes a specific uploaded photo from disk.
// ─────────────────────────────────────────────────────────────────────────────
export const deleteVehiclePhoto = async (req, res) => {
  try {
    const { filename } = req.params;
    // Security: only allow filenames that match our naming convention
    if (!/^vehicle-\d+-[\w-]+-\d+\.\w+$/.test(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const filepath = path.join(UPLOAD_ABS_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.json({ message: "Photo deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vehicles/docs                    ← ADMIN ONLY
// Returns document expiry dates for all vehicles from the vehicle_docs table.
// ─────────────────────────────────────────────────────────────────────────────
export const getVehicleDocs = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        vd.plate,
        CONVERT(VARCHAR(10), vd.registration_expiry,   23) AS reg_expiry,
        CONVERT(VARCHAR(10), vd.insurance_expiry,       23) AS ins_expiry,
        CONVERT(VARCHAR(10), vd.roadworthiness_expiry,  23) AS road_expiry,
        vd.updated_at,
        v.vehicle_type,
        v.model,
        v.status
      FROM vehicle_docs vd
      LEFT JOIN vehicles v ON v.plate_number = vd.plate
      ORDER BY vd.plate
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch vehicle docs" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/vehicles/docs/:plate             ← ADMIN ONLY
// Upserts document expiry dates for a vehicle identified by plate number.
// Body: { reg_expiry?, ins_expiry?, road_expiry? }  (YYYY-MM-DD strings)
// ─────────────────────────────────────────────────────────────────────────────
export const updateVehicleDocs = async (req, res) => {
  const plate   = req.params.plate;
  const adminId = req.user?.user_id ?? null;
  const { reg_expiry, ins_expiry, road_expiry } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("plate",   sql.NVarChar(50), plate)
      .input("reg",     sql.Date,         reg_expiry  || null)
      .input("ins",     sql.Date,         ins_expiry  || null)
      .input("road",    sql.Date,         road_expiry || null)
      .input("adminId", sql.Int,          adminId)
      .query(`
        IF EXISTS (SELECT 1 FROM vehicle_docs WHERE plate = @plate)
          UPDATE vehicle_docs
          SET registration_expiry    = @reg,
              insurance_expiry       = @ins,
              roadworthiness_expiry  = @road,
              updated_at             = GETUTCDATE(),
              updated_by_admin_id    = @adminId
          WHERE plate = @plate
        ELSE
          INSERT INTO vehicle_docs
            (plate, registration_expiry, insurance_expiry, roadworthiness_expiry,
             updated_at, updated_by_admin_id)
          VALUES
            (@plate, @reg, @ins, @road, GETUTCDATE(), @adminId)
      `);
    res.json({ message: "Vehicle docs updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update vehicle docs" });
  }
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getVehiclesNearby = async (req, res) => {
  const latitude = Number.parseFloat(req.query.latitude);
  const longitude = Number.parseFloat(req.query.longitude);
  const radiusKm = Number.parseFloat(req.query.radius_km || req.query.radius || 3);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: "latitude and longitude are required numeric query params" });
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return res.status(400).json({ error: "radius_km must be a positive number" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      WITH latest_vehicle_gps AS (
        SELECT
          t.vehicle_id,
          t.trip_id,
          g.latitude,
          g.longitude,
          g.recorded_at,
          ROW_NUMBER() OVER (PARTITION BY t.vehicle_id ORDER BY g.recorded_at DESC) AS rn
        FROM gps_logs g
        JOIN trips t ON t.trip_id = g.trip_id
        WHERE t.vehicle_id IS NOT NULL
      )
      SELECT
        v.vehicle_id,
        v.plate_number,
        v.vehicle_type,
        v.model,
        v.status,
        lg.trip_id,
        CAST(lg.latitude AS FLOAT) AS latitude,
        CAST(lg.longitude AS FLOAT) AS longitude,
        lg.recorded_at
      FROM latest_vehicle_gps lg
      JOIN vehicles v ON v.vehicle_id = lg.vehicle_id
      WHERE lg.rn = 1
    `);

    const nearbyVehicles = result.recordset
      .map((vehicle) => {
        const vehicleLat = Number.parseFloat(vehicle.latitude);
        const vehicleLng = Number.parseFloat(vehicle.longitude);
        if (!Number.isFinite(vehicleLat) || !Number.isFinite(vehicleLng)) {
          return null;
        }

        const distance_km = haversineKm(
          latitude,
          longitude,
          vehicleLat,
          vehicleLng
        );

        return {
          ...vehicle,
          distance_km: Number(distance_km.toFixed(3)),
        };
      })
      .filter(Boolean)
      .filter((vehicle) => vehicle.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json({
      center: { latitude, longitude },
      radius_km: radiusKm,
      count: nearbyVehicles.length,
      vehicles: nearbyVehicles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch nearby vehicles" });
  }
};
