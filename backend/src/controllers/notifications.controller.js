import sql from "mssql";

export const getAllNotifications = async (req, res) => {
  try {
    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
    const result = await pool
      .request()
      .query("SELECT * FROM notifications ORDER BY created_at DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE notifications SET is_read=1 WHERE notification_id=@id");
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { user_id, message } = req.body;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("message", sql.Text, message).query(`
        INSERT INTO notifications (user_id, message)
        VALUES (@user_id, @message)
      `);

    res.json({ message: "Notification sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserNotifications = async (req, res) => {
  try {
    const { user_id } = req.params;

    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);

    const result = await pool.request().input("user_id", sql.Int, user_id)
      .query(`
        SELECT *
        FROM notifications
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
