import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { verifyPassengerQrToken } from "../utils/passengerQr.js";

// POST /api/bookings — book one or more seats on a trip.
// Inserts one `tickets` row per seat, deducts the wallet once for the total
// fare, and records a wallet_transactions entry — all inside a single
// transaction so seat availability (derived live from `tickets`) and the
// wallet balance stay consistent with what was actually booked.
// Body: { trip_id: number, seats: string[] }   (user comes from the JWT)
export const createBooking = async (req, res) => {
  const userId = req.user?.user_id;
  const { trip_id, seats } = req.body;

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
          ISNULL((SELECT MIN(fz.base_fare) FROM fare_zones fz WHERE fz.route_id = t.route_id), 0) AS fare,
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

    const bookedSeats = new Set(trip.bookedSeatsCsv.split(",").filter(Boolean));
    const conflict = seats.find((s) => bookedSeats.has(String(s)));
    if (conflict) {
      await tx.rollback();
      return res.status(409).json({ error: `Seat ${conflict} is already booked` });
    }
    if (trip.booked + seats.length > trip.capacity) {
      await tx.rollback();
      return res.status(409).json({ error: "Not enough seats available on this trip" });
    }

    const fare      = parseFloat(trip.fare);
    const totalFare = fare * seats.length;

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
      .input("desc", sql.NVarChar(500), `Booking — ${seats.length} seat(s) on trip #${trip_id}`)
      .query(`
        INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
        VALUES (@uid, 'debit', @amt, @desc, GETUTCDATE())
      `);

    await tx.commit();

    const balanceResult = await pool.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance FROM wallets WHERE user_id = @uid");

    res.status(201).json({
      message:    "Booking confirmed",
      tickets,
      total:      totalFare,
      newBalance: parseFloat(balanceResult.recordset[0]?.balance ?? 0),
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
    const result = await pool.request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT
          tk.ticket_id,
          tk.trip_id,
          tk.seat_number,
          tk.amount,
          tk.created_at,
          v.model                                                              AS bus_name,
          LOWER(ISNULL(v.vehicle_type, 'bus'))                                 AS bus_type,
          r.start_location                                                     AS origin,
          r.end_location                                                       AS destination,
          CAST(DATEDIFF(MINUTE, t.start_time,
            ISNULL(t.end_time, DATEADD(MINUTE, 60, t.start_time)))
          AS VARCHAR) + ' min'                                                 AS duration,
          CASE
            WHEN tk.status = 'cancelled' THEN 'cancelled'
            WHEN t.status  = 'completed' THEN 'completed'
            ELSE 'upcoming'
          END                                                                  AS ui_status
        FROM tickets  tk
        JOIN trips    t ON t.trip_id    = tk.trip_id
        JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        JOIN routes   r ON r.route_id   = t.route_id
        WHERE tk.user_id = @id
        ORDER BY tk.ticket_id DESC
      `);

    const bookings = result.recordset.map((row) => ({
      _id:    String(row.ticket_id),
      type:   "bus",
      status: row.ui_status,
      bus: {
        _id:         row.trip_id,
        name:        row.bus_name,
        type:        row.bus_type,
        origin:      row.origin,
        destination: row.destination,
        duration:    row.duration,
      },
      seatId: row.seat_number,
      seats:  [row.seat_number],
      price:  parseFloat(row.amount),
      date:   row.created_at,
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

    const balanceResult = await pool.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance FROM wallets WHERE user_id = @uid");

    res.json({
      message:    "Booking cancelled",
      refund,
      newBalance: parseFloat(balanceResult.recordset[0]?.balance ?? 0),
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

      const passengerResult = await pool
        .request()
        .input("userId", sql.Int, Number.parseInt(passengerQr.payload.sub, 10))
        .query(`
          SELECT TOP 1
            u.user_id,
            u.full_name,
            u.email,
            t.ticket_id,
            t.trip_id,
            t.seat_number,
            t.status
          FROM users u
          LEFT JOIN tickets t ON t.user_id = u.user_id
          WHERE u.user_id = @userId
          ORDER BY t.ticket_id DESC
        `);

      return res.json({
        valid: true,
        mode: "rotating_passenger_qr",
        passenger: passengerResult.recordset[0] || { user_id: Number.parseInt(passengerQr.payload.sub, 10) },
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
