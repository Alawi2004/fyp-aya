import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { verifyPassengerQrToken } from "../utils/passengerQr.js";
import { getWalletBalance } from "../services/wallet.service.js";
import { getRouteDurationMin } from "../modules/eta/routeDuration.js";

// POST /api/bookings — book one or more seats on a trip.
// Body: { trip_id, seats, carpool? }
// - bus/van/minibus: seats = ['1','2',...], fare per seat from fare_zones
// - tuktuk: seats = ['FULL'], charged full trip price
// - taxi + carpool=false: seats = ['FULL'], charged full trip price
// - taxi + carpool=true:  seats = ['1','2',...], per-seat = trip_price / capacity
export const createBooking = async (req, res) => {
  const userId = req.user?.user_id;
  const { trip_id, seats, carpool = true } = req.body;

  if (!userId) return res.status(401).json({ error: "Authentication required" });
  if (!trip_id || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: "trip_id and a non-empty seats[] array are required" });
  }

  const pool = await poolPromise;
  const tx = pool.transaction();
  try {
    await tx.begin();

    const tripResult = await tx.request()
      .input("tid", sql.Int, trip_id)
      .query(`
        SELECT
          v.capacity,
          LOWER(ISNULL(v.vehicle_type, 'bus')) AS vehicle_type,
          ISNULL((SELECT MIN(fz.base_fare) FROM fare_zones fz WHERE fz.route_id = t.route_id AND fz.zone_name = 'Default'), 0) AS fare,
          (SELECT TOP 1 fz.base_fare FROM fare_zones fz WHERE fz.route_id = t.route_id AND fz.zone_name = 'Carpool') AS carpool_fare,
          (SELECT COUNT(*) FROM tickets tk WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled') AS booked,
          ISNULL((SELECT STRING_AGG(tk.seat_number, ',') FROM tickets tk
                  WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled'), '') AS bookedSeatsCsv
        FROM trips t
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE t.trip_id = @tid
      `);
    const trip = tripResult.recordset[0];
    if (!trip) {
      await tx.rollback();
      return res.status(404).json({ error: "Trip not found" });
    }

    const vehicleType  = trip.vehicle_type;
    const isFullTrip   = vehicleType === 'tuktuk' || (vehicleType === 'taxi' && !carpool);
    const baseFare     = parseFloat(trip.fare);
    const bookedSeats  = new Set(trip.bookedSeatsCsv.split(",").filter(Boolean));

    let fare, totalFare;

    if (isFullTrip) {
      // whole-vehicle booking — trip must have zero existing tickets
      if (trip.booked > 0) {
        await tx.rollback();
        return res.status(409).json({ error: "This trip is already booked" });
      }
      fare      = baseFare;
      totalFare = baseFare;
    } else if (vehicleType === 'taxi' && carpool) {
      // carpool taxi — must have a carpool fare configured
      if (!trip.carpool_fare) {
        await tx.rollback();
        return res.status(400).json({ error: "Carpool is not available for this trip" });
      }
      if (bookedSeats.has('FULL')) {
        await tx.rollback();
        return res.status(409).json({ error: "This trip has been booked as a private ride" });
      }
      const conflict = seats.find(s => bookedSeats.has(String(s)));
      if (conflict) {
        await tx.rollback();
        return res.status(409).json({ error: `Seat ${conflict} is already booked` });
      }
      if (trip.booked + seats.length > trip.capacity) {
        await tx.rollback();
        return res.status(409).json({ error: "Not enough seats available on this trip" });
      }
      fare      = parseFloat(trip.carpool_fare);
      totalFare = fare * seats.length;
    } else {
      // bus / van / minibus — standard per-seat fare
      if (bookedSeats.has('FULL')) {
        await tx.rollback();
        return res.status(409).json({ error: "This trip is already booked" });
      }
      const conflict = seats.find(s => bookedSeats.has(String(s)));
      if (conflict) {
        await tx.rollback();
        return res.status(409).json({ error: `Seat ${conflict} is already booked` });
      }
      if (trip.booked + seats.length > trip.capacity) {
        await tx.rollback();
        return res.status(409).json({ error: "Not enough seats available on this trip" });
      }
      fare      = baseFare;
      totalFare = fare * seats.length;
    }

    const walletResult = await tx.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance, is_frozen FROM wallets WHERE user_id = @uid");
    const wallet = walletResult.recordset[0];
    if (!wallet) {
      await tx.rollback();
      return res.status(400).json({ error: "Wallet not found for this account" });
    }
    if (wallet.is_frozen) {
      await tx.rollback();
      return res.status(403).json({ error: "Your wallet is frozen — contact support" });
    }
    if (parseFloat(wallet.balance) < totalFare) {
      await tx.rollback();
      return res.status(402).json({ error: "Insufficient wallet balance" });
    }

    await tx.request()
      .input("uid", sql.Int, userId)
      .input("amt", sql.Decimal(10, 2), totalFare)
      .query("UPDATE wallets SET balance = balance - @amt, updated_at = GETUTCDATE() WHERE user_id = @uid");

    const tickets = [];
    for (const seat of seats) {
      const inserted = await tx.request()
        .input("uid",  sql.Int, userId)
        .input("tid",  sql.Int, trip_id)
        .input("seat", sql.VarChar(10), String(seat))
        .input("amt",  sql.Decimal(10, 2), fare)
        .query(`
          INSERT INTO tickets (user_id, trip_id, seat_number, booking_time, status, amount, share_count, created_at)
          OUTPUT INSERTED.ticket_id, INSERTED.user_id, INSERTED.trip_id, INSERTED.seat_number,
                 INSERTED.status, INSERTED.amount, INSERTED.created_at
          VALUES (@uid, @tid, @seat, GETUTCDATE(), 'confirmed', @amt, 0, GETUTCDATE())
        `);
      tickets.push(inserted.recordset[0]);
    }

    await tx.request()
      .input("uid",  sql.Int, userId)
      .input("amt",  sql.Decimal(10, 2), totalFare)
      .input("desc", sql.NVarChar(500), isFullTrip ? `Booking — full trip #${trip_id}` : `Booking — ${seats.length} seat(s) on trip #${trip_id}`)
      .query(`
        INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
        VALUES (@uid, 'debit', @amt, @desc, GETUTCDATE())
      `);

    await tx.commit();

    const newBalance = await getWalletBalance(pool, userId);

    res.status(201).json({
      message:    "Booking confirmed",
      tickets,
      total:      totalFare,
      newBalance: parseFloat(newBalance),
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[createBooking]", err.message);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

// GET /api/bookings — the caller's own tickets, joined with trip/vehicle/route
// info and reshaped into the { bus: {...}, seats, status } shape the passenger
// app's "Upcoming Trips"/"Trip History" screens expect. `status` is computed
// from the ticket + trip state since the DB only stores 'confirmed'/'cancelled'
// on tickets, while the UI distinguishes upcoming/completed/cancelled.
export const getBookings = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const result = await pool.request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT
          tk.ticket_id                                                         AS booking_id,
          'bus'                                                                AS booking_source,
          tk.trip_id,
          tk.seat_number,
          CAST(tk.amount AS FLOAT)                                             AS amount,
          tk.created_at,
          v.model                                                              AS bus_name,
          LOWER(ISNULL(v.vehicle_type, 'bus'))                                 AS bus_type,
          r.start_location                                                     AS origin,
          r.end_location                                                       AS destination,
          NULL AS duration,   -- real duration computed from route geometry below
          CASE
            WHEN tk.status = 'cancelled' THEN 'cancelled'
            WHEN t.status  = 'completed' THEN 'completed'
            ELSE 'upcoming'
          END                                                                  AS ui_status,
          NULL AS vehicle_type,
          NULL AS driver_name,
          NULL AS scheduled_for,
          r.route_id,
          (SELECT TOP 1 rts.recurrence
           FROM recurring_trip_schedules rts
           WHERE rts.route_name = r.route_name AND rts.status = 'Active'
           ORDER BY rts.active_from DESC)                                       AS schedule_recurrence,
          NULL AS pickup_lat, NULL AS pickup_lng,
          NULL AS dest_lat,   NULL AS dest_lng,
          NULL AS stops_json, NULL AS distance_km
        FROM tickets  tk
        JOIN trips    t ON t.trip_id    = tk.trip_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        JOIN routes   r ON r.route_id   = t.route_id
        WHERE tk.user_id = @id

        UNION ALL

        SELECT
          tr.reservation_id                                                    AS booking_id,
          'taxi'                                                               AS booking_source,
          NULL                                                                 AS trip_id,
          NULL                                                                 AS seat_number,
          CAST(tr.estimated_fare AS FLOAT)                                     AS amount,
          tr.created_at,
          tr.vehicle_type                                                      AS bus_name,
          tr.vehicle_type                                                      AS bus_type,
          tr.pickup_address                                                    AS origin,
          tr.dest_address                                                      AS destination,
          CASE
            WHEN tr.distance_km IS NOT NULL
            THEN CAST(CAST(tr.distance_km AS DECIMAL(8,1)) AS VARCHAR) + ' km'
            ELSE NULL
          END                                                                  AS duration,
          CASE
            WHEN tr.status = 'cancelled' THEN 'cancelled'
            WHEN tr.status = 'completed' THEN 'completed'
            ELSE 'upcoming'
          END                                                                  AS ui_status,
          tr.vehicle_type                                                      AS vehicle_type,
          tr.driver_name                                                       AS driver_name,
          tr.scheduled_for                                                     AS scheduled_for,
          NULL                                                                 AS route_id,
          NULL                                                                 AS schedule_recurrence,
          tr.pickup_lat, tr.pickup_lng,
          tr.dest_lat,   tr.dest_lng,
          tr.stops_json, tr.distance_km
        FROM taxi_reservations tr
        WHERE tr.user_id = @id

        ORDER BY created_at DESC
      `);

    const durationCache = new Map();
    const bookings = await Promise.all(result.recordset.map(async (row) => {
      if (row.booking_source === 'taxi') {
        return {
          _id:         `taxi_${row.booking_id}`,
          type:        'taxi',
          status:      row.ui_status,
          vehicleType: row.vehicle_type,
          driverName:  row.driver_name,
          scheduledFor: row.scheduled_for,
          bus: {
            _id:         row.booking_id,
            name:        row.bus_name,
            type:        row.bus_type,
            origin:      row.origin,
            destination: row.destination,
            duration:    row.duration,
            // Real taxi coordinates + stops so the tracking map shows the
            // actual pickup → stops → destination (not a bus route).
            pickup:      (row.pickup_lat != null && row.pickup_lng != null)
                           ? { latitude: row.pickup_lat, longitude: row.pickup_lng } : null,
            dest:        (row.dest_lat != null && row.dest_lng != null)
                           ? { latitude: row.dest_lat, longitude: row.dest_lng } : null,
            distance_km: row.distance_km ?? null,
            stops:       (() => {
              try {
                const arr = row.stops_json ? JSON.parse(row.stops_json) : [];
                return Array.isArray(arr)
                  ? arr.filter((s) => s && s.lat != null && s.lng != null)
                       .map((s) => ({ address: s.address ?? '', latitude: s.lat, longitude: s.lng }))
                  : [];
              } catch { return []; }
            })(),
          },
          seatId: null,
          seats:  [],
          price:  parseFloat(row.amount ?? 0),
          date:   row.created_at,
        };
      }
      // Real road-based route duration — see routeDuration.js for why this
      // replaces the old end_time-based guess (always "60 min" otherwise).
      const durationMin = await getRouteDurationMin(pool, row.route_id, durationCache) ?? 60;
      return {
        _id:    String(row.booking_id),
        type:   "bus",
        status: row.ui_status,
        bus: {
          _id:                 row.trip_id,
          name:                row.bus_name,
          type:                row.bus_type,
          origin:              row.origin,
          destination:         row.destination,
          duration:            `${durationMin} min`,
          route_id:            row.route_id,
          schedule_recurrence: row.schedule_recurrence ?? null,
        },
        seatId: row.seat_number,
        seats:  [row.seat_number],
        price:  parseFloat(row.amount ?? 0),
        date:   row.created_at,
      };
    }));

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM tickets WHERE ticket_id=@id");
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch booking" });
  }
};

// DELETE /api/bookings/:id — cancel one of the caller's own bookings (only if
// not already cancelled) and refund its fare to their wallet. Runs inside a
// transaction so the ticket status, wallet balance and transaction log all
// move together — mirroring how createBooking debits on purchase.
export const cancelBooking = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const pool = await poolPromise;
  const tx = pool.transaction();
  try {
    await tx.begin();

    const ticketResult = await tx.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT ticket_id, user_id, status, amount FROM tickets WHERE ticket_id = @id");
    const ticket = ticketResult.recordset[0];

    if (!ticket) {
      await tx.rollback();
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (ticket.user_id !== userId) {
      await tx.rollback();
      return res.status(403).json({ error: "You can only cancel your own bookings" });
    }
    if (ticket.status === "cancelled") {
      await tx.rollback();
      return res.status(409).json({ error: "Ticket is already cancelled and cannot be modified." });
    }

    await tx.request()
      .input("id", sql.Int, ticket.ticket_id)
      .query("UPDATE tickets SET status = 'cancelled' WHERE ticket_id = @id");

    const refund = parseFloat(ticket.amount);
    await tx.request()
      .input("uid", sql.Int, userId)
      .input("amt", sql.Decimal(10, 2), refund)
      .query("UPDATE wallets SET balance = balance + @amt, updated_at = GETUTCDATE() WHERE user_id = @uid");

    await tx.request()
      .input("uid",  sql.Int, userId)
      .input("amt",  sql.Decimal(10, 2), refund)
      .input("desc", sql.NVarChar(500), `Refund — cancelled ticket #${ticket.ticket_id}`)
      .query(`
        INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
        VALUES (@uid, 'credit', @amt, @desc, GETUTCDATE())
      `);

    await tx.commit();

    const newBalance = await getWalletBalance(pool, userId);

    res.json({
      message:    "Booking cancelled",
      refund,
      newBalance: parseFloat(newBalance),
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[cancelBooking]", err.message);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
};

// POST /api/bookings/verify
export const verifyTicket = async (req, res) => {
  try {
    const token = req.body.token || req.body.qrCode;
    if (!token) {
      return res.status(400).json({ valid: false, message: "QR token is required" });
    }

    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const passengerQr = verifyPassengerQrToken(token);
    if (passengerQr.valid) {
      const qrRecordResult = await pool
        .request()
        .input("jti", sql.NVarChar(64), passengerQr.payload.jti)
        .input("tokenHash", sql.NVarChar(64), passengerQr.tokenHash)
        .query(`
          SELECT TOP 1 *
          FROM passenger_qr_tokens
          WHERE jti = @jti
            AND token_hash = @tokenHash
        `);

      const qrRecord = qrRecordResult.recordset[0];
      if (!qrRecord) {
        return res.status(404).json({ valid: false, message: "QR token not recognized" });
      }
      if (qrRecord.used_at) {
        return res.status(409).json({ valid: false, message: "QR token already used" });
      }
      if (qrRecord.revoked_at) {
        return res.status(409).json({ valid: false, message: "QR token has been revoked" });
      }
      if (new Date(qrRecord.expires_at) <= new Date()) {
        return res.status(401).json({ valid: false, message: "QR token expired" });
      }

      await pool
        .request()
        .input("jti", sql.NVarChar(64), passengerQr.payload.jti)
        .query(`
          UPDATE passenger_qr_tokens
          SET used_at = GETUTCDATE()
          WHERE jti = @jti
            AND used_at IS NULL
        `);

      const passengerId = Number.parseInt(passengerQr.payload.sub, 10);
      // Find an active ticket for a currently in-progress trip belonging to
      // this passenger. Fall back to any confirmed ticket if no trip is active
      // yet (e.g. driver verifies before departure).
      const passengerResult = await pool
        .request()
        .input("userId", sql.Int, passengerId)
        .query(`
          SELECT TOP 1
            u.user_id,
            u.full_name,
            u.email,
            t.ticket_id,
            t.trip_id,
            t.seat_number,
            t.status AS ticket_status,
            tr.status AS trip_status
          FROM users u
          JOIN tickets t ON t.user_id = u.user_id
          JOIN trips   tr ON tr.trip_id = t.trip_id
          WHERE u.user_id = @userId
            AND t.status  = 'confirmed'
            AND tr.status IN ('scheduled', 'in_progress', 'ongoing')
          ORDER BY
            CASE tr.status WHEN 'in_progress' THEN 0 ELSE 1 END,
            t.ticket_id DESC
        `);

      if (!passengerResult.recordset[0]) {
        return res.status(404).json({
          valid: false,
          message: "No active ticket found for this passenger",
        });
      }

      return res.json({
        valid: true,
        mode: "rotating_passenger_qr",
        passenger: passengerResult.recordset[0],
      });
    }

    const result = await pool
      .request()
      .input("qr", sql.VarChar, token)
      .query("SELECT * FROM tickets WHERE qr_code=@qr");
    const ticket = result.recordset[0];
    if (!ticket) return res.status(404).json({ valid: false, message: "Ticket not found" });
    res.json({ valid: true, ticket });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify ticket" });
  }
};
