import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

// POST /api/stop-requests
export const createStopRequest = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const { address, lat, lng, description } = req.body;
  if (!address?.trim()) {
    return res.status(400).json({ error: "address is required" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool.request()
      .input("userId",      sql.Int,           userId)
      .input("address",     sql.NVarChar(300),  address.trim())
      .input("lat",         sql.Float,          lat != null ? parseFloat(lat) : null)
      .input("lng",         sql.Float,          lng != null ? parseFloat(lng) : null)
      .input("description", sql.NVarChar(500),  description?.trim() || null)
      .query(`
        INSERT INTO stop_requests (user_id, address, lat, lng, description)
        OUTPUT INSERTED.request_id, INSERTED.address, INSERTED.lat, INSERTED.lng,
               INSERTED.description, INSERTED.status, INSERTED.created_at
        VALUES (@userId, @address, @lat, @lng, @description)
      `);

    res.status(201).json({ message: "Stop request submitted", request: result.recordset[0] });
  } catch (err) {
    console.error("[createStopRequest]", err);
    res.status(500).json({ error: "Failed to submit stop request" });
  }
};

// GET /api/stop-requests — passenger's own requests
export const getMyStopRequests = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT request_id, address, lat, lng, description, status, created_at
        FROM   stop_requests
        WHERE  user_id = @userId
        ORDER  BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("[getMyStopRequests]", err);
    res.status(500).json({ error: "Failed to fetch stop requests" });
  }
};
