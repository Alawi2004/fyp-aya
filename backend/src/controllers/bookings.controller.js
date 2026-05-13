import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { verifyPassengerQrToken } from "../utils/passengerQr.js";

// POST /api/bookings — book a ticket
export const createBooking = async (req, res) => {
  try {
    const { user_id, trip_id, seat_number } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("p_user_id", sql.Int, user_id)
      .input("p_trip_id", sql.Int, trip_id)
      .input("p_seat", sql.VarChar, seat_number)
      .execute("book_ticket");
    res.status(201).json({ message: "Booking confirmed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to create booking" });
  }
};

// GET /api/bookings
export const getBookings = async (req, res) => {
  try {
    const userId = req.query.user_id || req.user?.user_id;
    const pool = await poolPromise;
    const query = userId
      ? "SELECT * FROM tickets WHERE user_id=@id ORDER BY ticket_id DESC"
      : "SELECT * FROM tickets ORDER BY ticket_id DESC";
    const request = pool.request();
    if (userId) request.input("id", sql.Int, userId);
    const result = await request.query(query);
    res.json(result.recordset);
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

// DELETE /api/bookings/:id — cancel a booking
export const cancelBooking = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE tickets SET status='cancelled' WHERE ticket_id=@id");
    res.json({ message: "Booking cancelled" });
  } catch (err) {
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
