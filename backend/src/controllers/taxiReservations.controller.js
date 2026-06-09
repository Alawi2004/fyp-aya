import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

const toFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const toInt   = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 ? n : null; };

// POST /api/taxi-reservations
export const createTaxiReservation = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const {
    vehicle_type, pickup_address, pickup_lat, pickup_lng,
    dest_address, dest_lat, dest_lng, distance_km, estimated_fare,
    driver_id, driver_name, scheduled_for, recurrence, notes,
  } = req.body;

  if (!vehicle_type || !pickup_address?.trim() || !dest_address?.trim()) {
    return res.status(400).json({ error: "vehicle_type, pickup_address, and dest_address are required" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool.request()
      .input("userId",        sql.Int,            userId)
      .input("vehicleType",   sql.NVarChar(20),   vehicle_type)
      .input("pickupAddress", sql.NVarChar(300),  pickup_address.trim())
      .input("pickupLat",     sql.Float,          toFloat(pickup_lat))
      .input("pickupLng",     sql.Float,          toFloat(pickup_lng))
      .input("destAddress",   sql.NVarChar(300),  dest_address.trim())
      .input("destLat",       sql.Float,          toFloat(dest_lat))
      .input("destLng",       sql.Float,          toFloat(dest_lng))
      .input("distanceKm",    sql.Float,          toFloat(distance_km))
      .input("estimatedFare", sql.Decimal(10, 2), toFloat(estimated_fare) ?? 0)
      .input("driverId",      sql.Int,            toInt(driver_id))
      .input("driverName",    sql.NVarChar(100),  driver_name ?? null)
      .input("scheduledFor",  sql.NVarChar(100),  scheduled_for ?? "Now")
      .input("recurrence",    sql.NVarChar(20),   recurrence ?? "once")
      .input("notes",         sql.NVarChar(500),  notes ?? null)
      .query(`
        INSERT INTO taxi_reservations
          (user_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
           dest_address, dest_lat, dest_lng, distance_km, estimated_fare,
           driver_id, driver_name, scheduled_for, recurrence, notes)
        OUTPUT
          INSERTED.reservation_id, INSERTED.status, INSERTED.created_at,
          INSERTED.vehicle_type, INSERTED.pickup_address, INSERTED.dest_address,
          INSERTED.estimated_fare, INSERTED.scheduled_for, INSERTED.driver_name,
          INSERTED.distance_km
        VALUES
          (@userId, @vehicleType, @pickupAddress, @pickupLat, @pickupLng,
           @destAddress, @destLat, @destLng, @distanceKm, @estimatedFare,
           @driverId, @driverName, @scheduledFor, @recurrence, @notes)
      `);

    res.status(201).json({ message: "Reservation created", reservation: result.recordset[0] });
  } catch (err) {
    console.error("[createTaxiReservation]", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
};

// GET /api/taxi-reservations — passenger's own reservations
export const getMyTaxiReservations = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT
          tr.reservation_id,
          tr.vehicle_type,
          tr.pickup_address,
          tr.dest_address,
          tr.distance_km,
          CAST(tr.estimated_fare AS FLOAT) AS estimated_fare,
          tr.driver_id,
          tr.driver_name,
          tr.scheduled_for,
          tr.recurrence,
          tr.notes,
          tr.status,
          tr.created_at,
          v.plate_number,
          v.color  AS vehicle_color,
          v.model  AS vehicle_model,
          ROUND(AVG(CAST(r.rating AS FLOAT)), 1) AS driver_rating
        FROM taxi_reservations tr
        LEFT JOIN (
          SELECT driver_id, MAX(vehicle_id) AS vehicle_id
          FROM trips WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL
          GROUP BY driver_id
        ) lv ON lv.driver_id = tr.driver_id
        LEFT JOIN vehicles v ON v.vehicle_id = lv.vehicle_id
        LEFT JOIN trips t2   ON t2.driver_id = tr.driver_id
        LEFT JOIN ratings r  ON r.trip_id    = t2.trip_id
        WHERE tr.user_id = @userId
        GROUP BY
          tr.reservation_id, tr.vehicle_type, tr.pickup_address, tr.dest_address,
          tr.distance_km, tr.estimated_fare, tr.driver_id, tr.driver_name,
          tr.scheduled_for, tr.recurrence, tr.notes, tr.status, tr.created_at,
          v.plate_number, v.color, v.model
        ORDER BY tr.reservation_id DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("[getMyTaxiReservations]", err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
};
