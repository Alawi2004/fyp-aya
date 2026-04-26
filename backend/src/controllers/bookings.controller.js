import { poolPromise, sql } from "../db/db.js";

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
    const { qrCode } = req.body;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("qr", sql.VarChar, qrCode)
      .query("SELECT * FROM tickets WHERE qr_code=@qr");
    const ticket = result.recordset[0];
    if (!ticket) return res.status(404).json({ valid: false, message: "Ticket not found" });
    res.json({ valid: true, ticket });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify ticket" });
  }
};
