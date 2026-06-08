import { poolPromise, sql } from "../db/db.js";

export const getTickets = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.ticket_id,
        t.user_id,
        t.trip_id,
        t.seat_number,
        t.status,
        t.amount,
        t.booking_time,
        t.created_at,
        t.qr_code,
        u.full_name,
        r.route_name
      FROM tickets t
      LEFT JOIN users u  ON u.user_id  = t.user_id
      LEFT JOIN trips tr ON tr.trip_id = t.trip_id
      LEFT JOIN routes r ON r.route_id = tr.route_id
      ORDER BY t.ticket_id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

export const getTicketsByTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM tickets WHERE trip_id=@id");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

export const bookTicket = async (req, res) => {
  try {
    const { trip_id, seat_number } = req.body;
    // Allow admins/staff to book on behalf of a user; passengers use their own id
    const user_id = req.body.user_id ?? req.user?.user_id;
    if (!user_id || !trip_id || !seat_number) {
      return res.status(400).json({ error: "trip_id and seat_number are required" });
    }
    const pool = await poolPromise;

    await pool
      .request()
      .input("p_user_id", sql.Int, user_id)
      .input("p_trip_id", sql.Int, trip_id)
      .input("p_seat", sql.VarChar, seat_number)
      .execute("book_ticket");

    res.status(201).json({ message: "Ticket booked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to book ticket" });
  }
};
