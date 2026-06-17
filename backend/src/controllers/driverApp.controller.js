import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { verifyPassengerQrToken } from "../utils/passengerQr.js";
import { Expo } from "expo-server-sdk";
import { claimQrJti, getRedis } from "../services/redis.service.js";
import { broadcastGpsUpdate } from "../services/gps.stream.service.js";
import { createHash } from "crypto";

const QR_HMAC_SECRET = "yalla-transit-qr-secret-2026";

function verifyTicketQrHmac(payload) {
  const msg = `${payload.bid}:${payload.uid}:${payload.seat}:${payload.tid}`;
  const expected = createHash("sha256")
    .update(`${QR_HMAC_SECRET}:${msg}`)
    .digest("hex")
    .slice(0, 32);
  return expected === payload.sig;
}

const _expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// Push delay alert to all passengers with confirmed/boarded tickets on the trip.
// Fire-and-forget — errors are logged but never returned to the driver app.
async function _pushDelayToPassengers(pool, tripId, delayMin, reason) {
  try {
    const result = await pool.request()
      .input("trip_id", sql.Int, tripId)
      .query(`
        SELECT u.push_token
        FROM tickets t
        JOIN users u ON u.user_id = t.user_id
        WHERE t.trip_id = @trip_id
          AND t.status IN ('confirmed', 'boarded')
          AND u.push_token IS NOT NULL
      `);

    const tokens = result.recordset
      .map(r => r.push_token)
      .filter(t => Expo.isExpoPushToken(t));

    if (!tokens.length) return;

    const reasonSuffix = reason ? ` — ${reason}` : "";
    const messages = tokens.map(to => ({
      to,
      sound: "default",
      title: "⚠️ Trip Delay",
      body:  `Your trip is delayed by ${delayMin} min${reasonSuffix}.`,
      channelId: "default",
    }));

    for (const chunk of _expo.chunkPushNotifications(messages)) {
      try { await _expo.sendPushNotificationsAsync(chunk); } catch (e) {
        console.warn("[push] delay chunk error:", e.message);
      }
    }
  } catch (err) {
    console.warn("[push] delay push error:", err.message);
  }
}

// GET /api/driver/trips — trips assigned to the authenticated driver
export const getDriverTrips = async (req, res) => {
  try {
    const pool = await poolPromise;
    let driverId = req.query.driver_id || req.user?.driver_id;

    // Auto-resolve driver_id from JWT user_id if not supplied
    if (!driverId && req.user?.user_id) {
      const dr = await pool.request()
        .input("uid", sql.Int, req.user.user_id)
        .query("SELECT driver_id FROM drivers WHERE user_id = @uid");
      driverId = dr.recordset[0]?.driver_id;
    }
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const result = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT t.*, r.route_name, r.start_location, r.end_location,
               v.model AS vehicle_model, v.plate_number, v.capacity AS totalSeats,
               (SELECT ISNULL(SUM(tk.amount), 0) FROM tickets tk
                  WHERE tk.trip_id = t.trip_id AND tk.status <> 'cancelled') AS earnings,
               (SELECT COUNT(*) FROM tickets tk
                  WHERE tk.trip_id = t.trip_id AND tk.status <> 'cancelled') AS passengers
        FROM trips t
        JOIN routes r ON t.route_id = r.route_id
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        WHERE t.driver_id = @id
        ORDER BY t.start_time DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch driver trips" });
  }
};

// Helper: resolve driver_id for the authenticated user. Returns null if the user is not a driver.
async function resolveDriverId(pool, user) {
  if (user?.driver_id) return user.driver_id;
  if (!user?.user_id) return null;
  const dr = await pool.request()
    .input("uid", sql.Int, user.user_id)
    .query("SELECT driver_id FROM drivers WHERE user_id = @uid AND ISNULL(is_deleted, 0) = 0");
  return dr.recordset[0]?.driver_id ?? null;
}

// PUT /api/driver/trips/:id/start
export const startTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    const result = await pool
      .request()
      .input("id",  sql.Int, req.params.id)
      .input("did", sql.Int, driverId)
      .query("UPDATE trips SET status='ongoing', start_time = ISNULL(start_time, GETDATE()) WHERE trip_id=@id AND driver_id=@did");
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Trip not found or not assigned to you" });
    }
    res.json({ message: "Trip started" });
  } catch (err) {
    res.status(500).json({ error: "Failed to start trip" });
  }
};

// PUT /api/driver/trips/:id/complete
export const completeTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    const result = await pool
      .request()
      .input("id",  sql.Int, req.params.id)
      .input("did", sql.Int, driverId)
      .query("UPDATE trips SET status='completed', end_time = GETDATE() WHERE trip_id=@id AND driver_id=@did");
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Trip not found or not assigned to you" });
    }
    res.json({ message: "Trip completed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete trip" });
  }
};

// PUT /api/driver/trips/:id/cancel
export const cancelTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    const result = await pool
      .request()
      .input("id",  sql.Int, req.params.id)
      .input("did", sql.Int, driverId)
      .query(`
        UPDATE trips
        SET status = 'cancelled', end_time = GETDATE()
        WHERE trip_id = @id AND driver_id = @did AND status NOT IN ('completed', 'cancelled')
      `);
    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({ error: "Trip cannot be cancelled (not yours, already completed, or already cancelled)." });
    }
    res.json({ message: "Trip cancelled" });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel trip" });
  }
};

// GET /api/driver/trips/:id/passengers
export const getTripPassengers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    // Verify the trip belongs to this driver before exposing passenger details
    const ownership = await pool.request()
      .input("id",  sql.Int, req.params.id)
      .input("did", sql.Int, driverId)
      .query("SELECT 1 AS ok FROM trips WHERE trip_id = @id AND driver_id = @did");
    if (!ownership.recordset[0]) {
      return res.status(403).json({ error: "Trip not assigned to you" });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT tk.ticket_id, tk.seat_number, tk.status,
               u.full_name, u.email, u.phone
        FROM tickets tk
        JOIN users u ON tk.user_id = u.user_id
        WHERE tk.trip_id = @id
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch passengers" });
  }
};

// GET /api/driver/earnings
export const getDriverEarnings = async (req, res) => {
  try {
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    const result = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT COUNT(tk.ticket_id) AS total_tickets,
               SUM(tk.amount)      AS total_earnings
        FROM trips t
        JOIN tickets tk ON t.trip_id = tk.trip_id
        WHERE t.driver_id = @id AND t.status = 'completed'
      `);
    res.json(result.recordset[0] || { total_tickets: 0, total_earnings: 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};

// GET /api/driver/vehicle — the driver's currently assigned vehicle + maintenance summary
export const getDriverVehicle = async (req, res) => {
  try {
    const pool = await poolPromise;
    let driverId = req.query.driver_id;
    if (!driverId && req.user?.user_id) {
      const dr = await pool.request()
        .input("uid", sql.Int, req.user.user_id)
        .query("SELECT driver_id FROM drivers WHERE user_id = @uid");
      driverId = dr.recordset[0]?.driver_id;
    }
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    // Most recent vehicle this driver was assigned to (via trips)
    const vRes = await pool.request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT TOP 1 v.vehicle_id, v.plate_number, v.vehicle_type, v.capacity, v.model, v.status
        FROM trips t
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.driver_id = @id
        ORDER BY t.start_time DESC
      `);
    const vehicle = vRes.recordset[0];
    if (!vehicle) return res.json({ vehicle: null, maintenance: null });

    // Latest maintenance record → last service, next scheduled service, odometer
    const mRes = await pool.request()
      .input("vid", sql.Int, vehicle.vehicle_id)
      .query(`
        SELECT TOP 1 service_date, next_service_date, odometer_km, service_type
        FROM vehicle_maintenance_records
        WHERE vehicle_id = @vid
        ORDER BY service_date DESC
      `);
    const m = mRes.recordset[0] || null;

    res.json({
      vehicle: {
        vehicle_id:   vehicle.vehicle_id,
        plate_number: vehicle.plate_number,
        vehicle_type: vehicle.vehicle_type,
        capacity:     vehicle.capacity,
        model:        vehicle.model,
        status:       vehicle.status || "active",
      },
      maintenance: m ? {
        last_service: m.service_date,
        next_service: m.next_service_date,
        odometer_km:  m.odometer_km,
        service_type: m.service_type,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
};

// POST /api/driver/service-request — driver requests a maintenance service for their vehicle
export const createServiceRequest = async (req, res) => {
  try {
    const { service_type, service_date, notes } = req.body || {};
    if (!service_type || !service_date) {
      return res.status(400).json({ error: "service_type and service_date are required" });
    }
    const pool = await poolPromise;

    // Resolve driver + their current vehicle
    let driverId = req.query.driver_id;
    if (!driverId && req.user?.user_id) {
      const dr = await pool.request()
        .input("uid", sql.Int, req.user.user_id)
        .query("SELECT driver_id FROM drivers WHERE user_id = @uid");
      driverId = dr.recordset[0]?.driver_id;
    }
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const vRes = await pool.request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT TOP 1 t.vehicle_id
        FROM trips t
        WHERE t.driver_id = @id AND t.vehicle_id IS NOT NULL
        ORDER BY t.start_time DESC
      `);
    const vehicleId = vRes.recordset[0]?.vehicle_id;
    if (!vehicleId) return res.status(400).json({ error: "No vehicle assigned to you." });

    const ins = await pool.request()
      .input("vid",   sql.Int, vehicleId)
      .input("date",  sql.Date, service_date)
      .input("type",  sql.NVarChar(100), String(service_type).slice(0, 100))
      .input("notes", sql.NVarChar(500), notes ? String(notes).slice(0, 500) : null)
      .input("by",    sql.Int, req.user?.user_id ?? null)
      .query(`
        INSERT INTO vehicle_maintenance_records
          (vehicle_id, service_date, service_type, mechanic, notes, created_at, created_by)
        OUTPUT INSERTED.record_id
        VALUES (@vid, @date, @type, 'Pending assignment', @notes, GETDATE(), @by)
      `);

    res.status(201).json({ message: "Service request submitted", record_id: ins.recordset[0]?.record_id });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit service request" });
  }
};

// POST /api/driver/issues
export const reportIssue = async (req, res) => {
  try {
    const { trip_id, description } = req.body;
    if (!description) return res.status(400).json({ error: "description is required" });

    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    await pool
      .request()
      .input("driver_id",   sql.Int,  driverId)
      .input("trip_id",     sql.Int,  trip_id || null)
      .input("description", sql.NVarChar(1000), String(description).slice(0, 1000))
      .query(`
        INSERT INTO issues (driver_id, trip_id, description, created_at)
        VALUES (@driver_id, @trip_id, @description, GETDATE())
      `);
    res.status(201).json({ message: "Issue reported" });
  } catch (err) {
    res.status(500).json({ error: "Failed to report issue" });
  }
};

// POST /api/driver/emergency
export const sendEmergency = async (req, res) => {
  try {
    const { trip_id, message } = req.body;
    const pool = await poolPromise;
    const driverId = await resolveDriverId(pool, req.user);
    if (!driverId) return res.status(403).json({ error: "Driver profile not found" });

    await pool
      .request()
      .input("driver_id", sql.Int,  driverId)
      .input("trip_id",   sql.Int,  trip_id || null)
      .input("message",   sql.NVarChar(1000), String(message || "Emergency alert").slice(0, 900))
      .query(`
        INSERT INTO issues (driver_id, trip_id, description, created_at)
        VALUES (@driver_id, @trip_id, CONCAT('EMERGENCY: ', @message), GETDATE())
      `);
    res.status(201).json({ message: "Emergency alert sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send emergency" });
  }
};

// POST /api/driver/scan-qr — verify passenger ticket QR and check trip validity
// Accepts the JSON QR format generated by the passenger TicketScreen:
//   { bid, tid, uid, seat, fare, sig }  (HMAC-SHA256, first 32 hex chars)
// Also accepts the legacy JWT token format for backwards compatibility.
// Body: { token: string, trip_id?: number }
export const scanPassengerQr = async (req, res) => {
  const { token, trip_id: driverTripId } = req.body;
  if (!token) return res.status(400).json({ valid: false, message: "QR token required" });

  const pool = await poolPromise;
  await ensureOperationalTables(pool);

  // ── Parse QR ─────────────────────────────────────────────────────────────
  let qrPayload = null;
  let isLegacyJwt = false;

  try {
    const parsed = JSON.parse(token);
    // Ticket QR: must have tid (ticket_id) and sig (HMAC)
    if (parsed && parsed.tid && parsed.sig) {
      qrPayload = parsed;
    }
  } catch (_) {}

  if (!qrPayload) {
    // Fall back to legacy JWT token path
    const passengerQr = verifyPassengerQrToken(token);
    if (!passengerQr.valid) {
      return res.status(401).json({ valid: false, message: "Invalid or malformed QR code" });
    }
    isLegacyJwt = true;
    qrPayload = { _legacy: true, userId: parseInt(passengerQr.payload.sub, 10), jti: passengerQr.payload.jti, tokenHash: passengerQr.tokenHash };
  }

  // ── HMAC verification (ticket QR only) ───────────────────────────────────
  if (!isLegacyJwt) {
    if (!verifyTicketQrHmac(qrPayload)) {
      return res.status(401).json({ valid: false, message: "QR signature invalid — ticket may have been tampered with" });
    }
  }

  // ── DB lookup ─────────────────────────────────────────────────────────────
  try {
    let ticket = null;
    let userId = null;

    if (isLegacyJwt) {
      // Legacy path: find latest confirmed ticket for the user
      userId = qrPayload.userId;
      const r = await pool.request()
        .input("userId", sql.Int, userId)
        .query(`
          SELECT TOP 1 t.ticket_id, t.trip_id, t.seat_number, t.amount, t.status,
                       u.full_name, u.email,
                       r.route_name, r.start_location, r.end_location,
                       tr.start_time
          FROM tickets t
          JOIN users   u  ON u.user_id   = t.user_id
          JOIN trips   tr ON tr.trip_id  = t.trip_id
          JOIN routes  r  ON r.route_id  = tr.route_id
          WHERE t.user_id = @userId AND t.status = 'confirmed'
          ORDER BY t.ticket_id DESC
        `);
      ticket = r.recordset[0];
    } else {
      // Ticket QR path: look up by exact ticket_id + user_id from payload
      userId = parseInt(qrPayload.uid, 10);
      const ticketId = parseInt(qrPayload.tid, 10);
      const r = await pool.request()
        .input("ticketId", sql.Int, ticketId)
        .input("userId",   sql.Int, userId)
        .query(`
          SELECT TOP 1 t.ticket_id, t.trip_id, t.seat_number, t.amount, t.status,
                       u.full_name, u.email,
                       r.route_name, r.start_location, r.end_location,
                       tr.start_time
          FROM tickets t
          JOIN users   u  ON u.user_id   = t.user_id
          JOIN trips   tr ON tr.trip_id  = t.trip_id
          JOIN routes  r  ON r.route_id  = tr.route_id
          WHERE t.ticket_id = @ticketId AND t.user_id = @userId
        `);
      ticket = r.recordset[0];
    }

    // ── Ticket status checks ───────────────────────────────────────────────
    if (!ticket) {
      return res.status(404).json({ valid: false, message: "Ticket not found" });
    }
    if (ticket.status === "boarded") {
      return res.status(409).json({
        valid: false,
        message: "Ticket already used — passenger has already boarded",
        passenger: { name: ticket.full_name, seat_number: ticket.seat_number },
      });
    }
    if (ticket.status === "cancelled") {
      return res.status(409).json({
        valid: false,
        message: "Ticket has been cancelled",
        passenger: { name: ticket.full_name, seat_number: ticket.seat_number },
      });
    }
    if (ticket.status !== "confirmed") {
      return res.status(409).json({
        valid: false,
        message: `Ticket status is '${ticket.status}' — cannot board`,
        passenger: { name: ticket.full_name, seat_number: ticket.seat_number },
      });
    }

    // ── Trip match check ──────────────────────────────────────────────────
    const tripMatch = !driverTripId || (parseInt(driverTripId, 10) === ticket.trip_id);
    if (!tripMatch) {
      // Wrong trip — return full info so driver sees the mismatch clearly
      return res.status(200).json({
        valid: false,
        wrong_trip: true,
        message: `Ticket is for a different trip (Trip #${ticket.trip_id})`,
        ticket: {
          ticket_id:    ticket.ticket_id,
          trip_id:      ticket.trip_id,
          route_name:   ticket.route_name,
          start_location: ticket.start_location,
          end_location:   ticket.end_location,
          start_time:   ticket.start_time,
          seat_number:  ticket.seat_number,
        },
        passenger: {
          name:       ticket.full_name,
          email:      ticket.email,
          seat_number: ticket.seat_number,
        },
      });
    }

    // ── All checks passed — deduct fare and mark boarded ──────────────────
    const tx = pool.transaction();
    await tx.begin();
    try {
      let amountDeducted = 0;
      let newBalance = null;
      let fareInsufficient = false;

      const fare = parseFloat(ticket.amount ?? 0);
      if (fare > 0) {
        const walletRes = await tx.request()
          .input("uid", sql.Int, userId)
          .query(`SELECT balance, is_frozen FROM wallets WHERE user_id=@uid`);
        const wallet = walletRes.recordset[0];

        if (wallet?.is_frozen) {
          // Frozen wallet = active fraud block — deny boarding entirely
          await tx.rollback().catch(() => {});
          return res.status(403).json({
            valid: false,
            message: "Passenger wallet is frozen — boarding denied. Contact support.",
            passenger: { name: ticket.full_name, seat_number: ticket.seat_number },
          });
        }

        if (wallet && parseFloat(wallet.balance) >= fare) {
          await tx.request()
            .input("uid",  sql.Int,            userId)
            .input("fare", sql.Decimal(10, 2), fare)
            .query(`UPDATE wallets SET balance=balance-@fare WHERE user_id=@uid`);

          await tx.request()
            .input("uid",      sql.Int,            userId)
            .input("fare",     sql.Decimal(10, 2), fare)
            .input("ticketId", sql.Int,            ticket.ticket_id)
            .query(`
              INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
              VALUES (@uid, 'debit', @fare, CONCAT('Bus fare — Ticket #', @ticketId), GETUTCDATE())
            `);

          amountDeducted = fare;
          const balRes = await tx.request()
            .input("uid", sql.Int, userId)
            .query(`SELECT balance FROM wallets WHERE user_id=@uid`);
          newBalance = parseFloat(balRes.recordset[0]?.balance ?? 0);
        } else {
          fareInsufficient = true;
        }
      }

      // Allow boarding even on insufficient balance (service continuity), but flag it.
      // Frozen wallets are blocked above before reaching this point.
      await tx.request()
        .input("ticketId", sql.Int, ticket.ticket_id)
        .query(`UPDATE tickets SET status='boarded' WHERE ticket_id=@ticketId`);

      await tx.commit();

      return res.json({
        valid: true,
        passenger: {
          name:        ticket.full_name,
          email:       ticket.email,
          seat_number: ticket.seat_number,
          ticket_id:   ticket.ticket_id,
        },
        trip: {
          trip_id:        ticket.trip_id,
          route_name:     ticket.route_name,
          start_location: ticket.start_location,
          end_location:   ticket.end_location,
          start_time:     ticket.start_time,
        },
        fare_deducted:     amountDeducted > 0,
        amount_deducted:   amountDeducted,
        new_balance:       newBalance,
        fare_insufficient: fareInsufficient,
      });
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  } catch (err) {
    res.status(500).json({ valid: false, error: "Failed to process QR scan" });
  }
};

// POST /api/driver/trips/:id/stops/:stopId/arrive
export const markStopArrival = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const stopId = parseInt(req.params.stopId, 10);
    const pool = await poolPromise;
    await pool.request()
      .input("trip_id",    sql.Int,       tripId)
      .input("stop_id",    sql.Int,       stopId)
      .input("arrived_at", sql.DateTime2, new Date())
      .query(`
        IF EXISTS (SELECT 1 FROM trip_stop_arrivals WHERE trip_id=@trip_id AND stop_id=@stop_id)
          UPDATE trip_stop_arrivals
          SET actual_arrival_at=@arrived_at, updated_at=GETUTCDATE(), arrival_status='arrived'
          WHERE trip_id=@trip_id AND stop_id=@stop_id
        ELSE
          INSERT INTO trip_stop_arrivals (trip_id, stop_id, actual_arrival_at, arrival_status, created_at, updated_at)
          VALUES (@trip_id, @stop_id, @arrived_at, 'arrived', GETUTCDATE(), GETUTCDATE())
      `);
    res.json({ message: "Stop arrival recorded" });
  } catch (err) {
    res.status(500).json({ error: "Failed to record stop arrival" });
  }
};

// POST /api/driver/trips/:id/checklist
export const submitChecklist = async (req, res) => {
  try {
    const { fuel_ok, lights_ok, tires_ok } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("trip_id",   sql.Int, req.params.id)
      .input("fuel_ok",   sql.Bit, fuel_ok   ? 1 : 0)
      .input("lights_ok", sql.Bit, lights_ok ? 1 : 0)
      .input("tires_ok",  sql.Bit, tires_ok  ? 1 : 0)
      .query(`
        INSERT INTO trip_checklists (trip_id, fuel_ok, lights_ok, tires_ok, submitted_at)
        VALUES (@trip_id, @fuel_ok, @lights_ok, @tires_ok, GETDATE())
      `);
    res.status(201).json({ message: "Checklist submitted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit checklist" });
  }
};

// POST /api/driver/trips/:id/delay — record delay and count affected passengers
export const reportDelay = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const { reason, delay_minutes, notes } = req.body;
    if (!reason || !delay_minutes) {
      return res.status(400).json({ error: 'reason and delay_minutes required' });
    }
    const pool = await poolPromise;

    await pool.request()
      .input('trip_id',       sql.Int,           tripId)
      .input('reason',        sql.NVarChar(100),  reason)
      .input('delay_minutes', sql.Int,            delay_minutes)
      .input('notes',         sql.NVarChar(500),  notes ?? null)
      .query(`
        INSERT INTO trip_delays (trip_id, reason, delay_minutes, notes, reported_at)
        VALUES (@trip_id, @reason, @delay_minutes, @notes, GETDATE())
      `);

    const countResult = await pool.request()
      .input('trip_id', sql.Int, tripId)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM tickets
        WHERE trip_id = @trip_id AND status IN ('confirmed', 'boarded')
      `);

    const affectedCount = countResult.recordset[0]?.cnt ?? 0;

    res.status(201).json({
      message: 'Delay reported',
      affected_passengers: affectedCount,
    });

    // Push to passengers asynchronously after response is sent
    _pushDelayToPassengers(pool, tripId, delay_minutes, reason);
  } catch (err) {
    res.status(500).json({ error: 'Failed to report delay' });
  }
};

// POST /api/driver/location
export const updateLocation = async (req, res) => {
  try {
    const { trip_id, latitude, longitude } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("trip_id", sql.Int, trip_id)
      .input("lat", sql.Decimal(9, 6), latitude)
      .input("lng", sql.Decimal(9, 6), longitude)
      .query(`
        INSERT INTO gps_logs (trip_id, latitude, longitude, recorded_at)
        VALUES (@trip_id, @lat, @lng, GETDATE())
      `);
    res.json({ message: "Location updated" });

    // Fire-and-forget: broadcast to WebSocket subscribers keyed by both plate and trip_id
    pool.request()
      .input("tid", sql.Int, trip_id)
      .query(`
        SELECT v.plate_number AS vehicle_id, r.route_name AS route
        FROM trips t
        LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        LEFT JOIN routes   r ON r.route_id   = t.route_id
        WHERE t.trip_id = @tid
      `)
      .then(tripRow => {
        const meta = tripRow.recordset[0] ?? {};
        broadcastGpsUpdate({
          trip_id,
          vehicle_id:  meta.vehicle_id ?? null,
          route:       meta.route      ?? null,
          lat:         parseFloat(latitude),
          lng:         parseFloat(longitude),
          recorded_at: new Date().toISOString(),
        });
      })
      .catch(() => {});
  } catch (err) {
    res.status(500).json({ error: "Failed to update location" });
  }
};
