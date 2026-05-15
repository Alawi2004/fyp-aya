import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { verifyPassengerQrToken } from "../utils/passengerQr.js";

// GET /api/driver/trips — trips assigned to the authenticated driver
// Uses driver_id from query param until auth middleware is added
export const getDriverTrips = async (req, res) => {
  try {
    const driverId = req.query.driver_id || req.user?.driver_id;
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT t.*, r.route_name, r.start_location, r.end_location,
               v.model AS vehicle_model, v.plate_number
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

// PUT /api/driver/trips/:id/start
export const startTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE trips SET status='ongoing' WHERE trip_id=@id");
    res.json({ message: "Trip started" });
  } catch (err) {
    res.status(500).json({ error: "Failed to start trip" });
  }
};

// PUT /api/driver/trips/:id/complete
export const completeTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE trips SET status='completed' WHERE trip_id=@id");
    res.json({ message: "Trip completed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete trip" });
  }
};

// GET /api/driver/trips/:id/passengers
export const getTripPassengers = async (req, res) => {
  try {
    const pool = await poolPromise;
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
    const driverId = req.query.driver_id || req.user?.driver_id;
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const pool = await poolPromise;
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

// POST /api/driver/issues
export const reportIssue = async (req, res) => {
  try {
    const { driver_id, trip_id, description } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("driver_id", sql.Int, driver_id)
      .input("trip_id", sql.Int, trip_id || null)
      .input("description", sql.Text, description)
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
    const { driver_id, trip_id, message } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("driver_id", sql.Int, driver_id)
      .input("trip_id", sql.Int, trip_id || null)
      .input("message", sql.Text, message || "Emergency alert")
      .query(`
        INSERT INTO issues (driver_id, trip_id, description, created_at)
        VALUES (@driver_id, @trip_id, 'EMERGENCY: ' + @message, GETDATE())
      `);
    res.status(201).json({ message: "Emergency alert sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send emergency" });
  }
};

// POST /api/driver/scan-qr — verify passenger QR and deduct fare from wallet
export const scanPassengerQr = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ valid: false, message: "QR token required" });

  const pool = await poolPromise;
  await ensureOperationalTables(pool);

  const passengerQr = verifyPassengerQrToken(token);
  if (!passengerQr.valid) {
    return res.status(401).json({ valid: false, message: "Invalid or malformed QR token" });
  }

  const tx = pool.transaction();
  try {
    await tx.begin();

    const qrResult = await tx.request()
      .input("jti",       sql.NVarChar(64), passengerQr.payload.jti)
      .input("tokenHash", sql.NVarChar(64), passengerQr.tokenHash)
      .query(`SELECT TOP 1 * FROM passenger_qr_tokens WHERE jti=@jti AND token_hash=@tokenHash`);

    const qrRecord = qrResult.recordset[0];
    if (!qrRecord)               { await tx.rollback(); return res.status(404).json({ valid: false, message: "QR not recognised" }); }
    if (qrRecord.used_at)        { await tx.rollback(); return res.status(409).json({ valid: false, message: "QR already used" }); }
    if (qrRecord.revoked_at)     { await tx.rollback(); return res.status(409).json({ valid: false, message: "QR has been revoked" }); }
    if (new Date(qrRecord.expires_at) <= new Date()) { await tx.rollback(); return res.status(401).json({ valid: false, message: "QR expired" }); }

    const userId = parseInt(passengerQr.payload.sub, 10);

    // Get latest confirmed ticket for this passenger
    const ticketResult = await tx.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 1 t.ticket_id, t.trip_id, t.seat_number, t.amount,
                     u.full_name, u.email
        FROM tickets t
        JOIN users u ON u.user_id = t.user_id
        WHERE t.user_id = @userId AND t.status = 'confirmed'
        ORDER BY t.ticket_id DESC
      `);
    const ticket = ticketResult.recordset[0];

    // Mark QR as used
    await tx.request()
      .input("jti", sql.NVarChar(64), passengerQr.payload.jti)
      .query(`UPDATE passenger_qr_tokens SET used_at=GETUTCDATE() WHERE jti=@jti AND used_at IS NULL`);

    // Deduct fare if ticket exists and wallet has sufficient balance
    let amountDeducted = 0;
    let newBalance = null;
    if (ticket?.amount) {
      const fare = parseFloat(ticket.amount);
      const walletRes = await tx.request()
        .input("uid", sql.Int, userId)
        .query(`SELECT balance, is_frozen FROM wallets WHERE user_id=@uid`);
      const wallet = walletRes.recordset[0];

      if (wallet && !wallet.is_frozen && parseFloat(wallet.balance) >= fare) {
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

        await tx.request()
          .input("ticketId", sql.Int, ticket.ticket_id)
          .query(`UPDATE tickets SET status='boarded' WHERE ticket_id=@ticketId`);

        amountDeducted = fare;
        const balRes = await tx.request()
          .input("uid", sql.Int, userId)
          .query(`SELECT balance FROM wallets WHERE user_id=@uid`);
        newBalance = parseFloat(balRes.recordset[0]?.balance ?? 0);
      }
    }

    await tx.commit();
    return res.json({
      valid: true,
      passenger: {
        name:        ticket?.full_name  ?? "Passenger",
        email:       ticket?.email      ?? null,
        seat_number: ticket?.seat_number ?? null,
        ticket_id:   ticket?.ticket_id  ?? null,
      },
      fare_deducted:   amountDeducted > 0,
      amount_deducted: amountDeducted,
      new_balance:     newBalance,
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    res.status(500).json({ error: "Failed to process QR scan" });
  }
};

// POST /api/driver/trips/:id/stops/:stopId/arrive
export const markStopArrival = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const stopId = parseInt(req.params.stopId, 10);
    const pool = await poolPromise;
    await pool.request()
      .input("trip_id",    sql.Int,      tripId)
      .input("stop_id",    sql.Int,      stopId)
      .input("arrived_at", sql.DateTime, new Date())
      .query(`
        IF EXISTS (SELECT 1 FROM trip_stop_arrivals WHERE trip_id=@trip_id AND stop_id=@stop_id)
          UPDATE trip_stop_arrivals
          SET actual_arrival=@arrived_at
          WHERE trip_id=@trip_id AND stop_id=@stop_id
        ELSE
          INSERT INTO trip_stop_arrivals (trip_id, stop_id, actual_arrival)
          VALUES (@trip_id, @stop_id, @arrived_at)
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

    res.status(201).json({
      message: 'Delay reported',
      affected_passengers: countResult.recordset[0]?.cnt ?? 0,
    });
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
  } catch (err) {
    res.status(500).json({ error: "Failed to update location" });
  }
};
