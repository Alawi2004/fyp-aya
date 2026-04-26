import sql from "mssql";

export const getRatings = async (req, res) => {
  try {
    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
    const result = await pool.request().query("SELECT * FROM ratings");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRating = async (req, res) => {
  try {
    const { user_id, trip_id, rating, comment } = req.body;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("trip_id", sql.Int, trip_id)
      .input("rating", sql.Int, rating)
      .input("comment", sql.Text, comment).query(`
        INSERT INTO ratings (user_id, trip_id, rating, comment)
        VALUES (@user_id, @trip_id, @rating, @comment)
      `);

    res.json({ message: "Rating added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTripRatings = async (req, res) => {
  try {
    const { trip_id } = req.params;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    const result = await pool.request().input("trip_id", sql.Int, trip_id)
      .query(`
        SELECT *
        FROM ratings
        WHERE trip_id = @trip_id
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
