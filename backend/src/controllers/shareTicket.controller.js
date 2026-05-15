import { issueShareToken, verifyShareToken } from '../utils/shareToken.js';
import { poolPromise } from '../db/db.js';
import sql from 'mssql';

const SHARE_BASE_URL = process.env.SHARE_BASE_URL || 'https://yallatransit.app';
const APP_SCHEME     = 'yallatransit';

// ── POST /api/share/ticket/token  (requireAuth) ───────────────────────────────
export const issueToken = async (req, res) => {
  const { bookingId, seatId, userId } = req.body;
  if (!bookingId || !seatId) {
    return res.status(400).json({ error: 'bookingId and seatId are required' });
  }

  const uid = userId || req.user?.id || 'guest';
  const { token, expiresAt } = issueShareToken(bookingId, uid, seatId);

  const shareUrl = `${SHARE_BASE_URL}/ticket/share?t=${token}`;
  const deepLink = `${APP_SCHEME}://ticket/share?t=${token}`;

  // Increment share analytics — non-critical, log but don't fail
  try {
    const pool = await poolPromise;
    if (pool) {
      await pool.request()
        .input('bid', sql.NVarChar(100), String(bookingId))
        .query(`
          UPDATE tickets
          SET share_count     = ISNULL(share_count, 0) + 1,
              last_shared_at  = SYSDATETIME()
          WHERE ticket_number = @bid OR id = @bid
        `);
    }
  } catch (e) {
    console.warn('[share] analytics update skipped:', e.message);
  }

  return res.json({ token, shareUrl, deepLink, expiresAt });
};

// ── GET /api/share/ticket?t=TOKEN  (public, rate-limited) ────────────────────
export const getSharedTicket = (req, res) => {
  const { t: token } = req.query;
  if (!token) return res.status(400).json({ error: 'Query param ?t is required' });

  const result = verifyShareToken(token);
  if (!result.valid) {
    const msg = result.reason === 'expired'
      ? 'This ticket link has expired (valid for 7 days after sharing).'
      : 'Invalid or tampered ticket link.';
    return res.status(401).json({ valid: false, reason: result.reason, error: msg });
  }

  return res.json({
    valid: true,
    bookingId: result.payload.bid,
    seatId:    result.payload.seat,
    issuedAt:  new Date(result.payload.iat * 1000).toISOString(),
    expiresAt: new Date(result.payload.exp * 1000).toISOString(),
  });
};

// ── POST /api/share/ticket/verify  (requireAuth — driver/inspector use) ───────
export const verifyShareQr = (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });

  const result = verifyShareToken(token);
  return res.json({
    valid:     result.valid,
    bookingId: result.valid ? result.payload.bid  : undefined,
    seatId:    result.valid ? result.payload.seat : undefined,
    reason:    result.reason ?? null,
  });
};
