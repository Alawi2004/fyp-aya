import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { issuePassengerQrToken } from "../utils/passengerQr.js";

export const getPassengerQr = async (req, res) => {
  if (req.user?.role !== "passenger") {
    return res.status(403).json({ error: "Forbidden - passenger access only" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    // Only one still-valid boarding QR remains active per passenger.
    await pool
      .request()
      .input("userId", sql.Int, req.user.user_id)
      .query(`
        UPDATE passenger_qr_tokens
        SET revoked_at = GETUTCDATE()
        WHERE user_id = @userId
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > GETUTCDATE()
      `);

    const issued = issuePassengerQrToken(req.user.user_id);

    await pool
      .request()
      .input("userId", sql.Int, req.user.user_id)
      .input("jti", sql.NVarChar(64), issued.jti)
      .input("tokenHash", sql.NVarChar(64), issued.tokenHash)
      .input("expiresAt", sql.DateTime2, issued.expiresAt)
      .query(`
        INSERT INTO passenger_qr_tokens (user_id, jti, token_hash, expires_at)
        VALUES (@userId, @jti, @tokenHash, @expiresAt)
      `);

    res.json({
      token: issued.token,
      token_type: "boarding_qr",
      expires_at: issued.expiresAt.toISOString(),
      expires_in_seconds: issued.expiresInSeconds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate passenger QR token" });
  }
};
