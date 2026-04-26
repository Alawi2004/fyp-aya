import { poolPromise, sql } from "../db/db.js";

export const getTickets = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM tickets");
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
  const { user_id, trip_id, seat_number } = req.body;
  const pool = await poolPromise;

  await pool
    .request()
    .input("p_user_id", sql.Int, user_id)
    .input("p_trip_id", sql.Int, trip_id)
    .input("p_seat", sql.VarChar, seat_number)
    .execute("book_ticket");

  res.status(201).json({ message: "Ticket booked" });
};
