import sql from "mssql";

export const recordPassengerCount = async (req, res) => {
  try {
    const { trip_id, passenger_count, method } = req.body;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    await pool
      .request()
      .input("trip_id", sql.Int, trip_id)
      .input("passenger_count", sql.Int, passenger_count)
      .input("method", sql.VarChar, method || "camera").query(`
        INSERT INTO passenger_counts (trip_id, passenger_count, method)
        VALUES (@trip_id, @passenger_count, @method)
      `);

    res.json({ message: "Passenger count recorded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record passenger count" });
  }
};

export const getPassengerCountsByTrip = async (req, res) => {
  try {
    const { trip_id } = req.params;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    const result = await pool.request().input("trip_id", sql.Int, trip_id)
      .query(`
        SELECT *
        FROM passenger_counts
        WHERE trip_id = @trip_id
        ORDER BY recorded_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
