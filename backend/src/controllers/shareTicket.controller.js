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

// ── Shared ticket HTML page (for browser visits) ─────────────────────────────
const buildTicketHtml = (payload, token, req) => {
  const deepLink = `yallatransit://ticket/share?t=${token}`;
  const expDate  = new Date(payload.exp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const host     = `${req.protocol}://${req.get('host')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yalla Transit Ticket</title>
  <meta property="og:title" content="Yalla Transit Ticket">
  <meta property="og:description" content="Booking #${payload.bid} · Seat ${payload.seat} · Valid until ${expDate}">
  <meta property="og:image" content="${host}/uploads/og-ticket.png">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#F1F5F9;min-height:100vh;display:flex;flex-direction:column;
         align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:20px;width:100%;max-width:400px;
          box-shadow:0 8px 40px rgba(0,0,0,0.12);overflow:hidden}
    .hdr{background:linear-gradient(135deg,#2563EB,#1D4ED8);
         padding:24px 20px;color:#fff;position:relative;overflow:hidden}
    .hdr::before{content:'';position:absolute;width:180px;height:180px;border-radius:50%;
                 background:rgba(255,255,255,.07);top:-60px;right:-40px}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:4px}
    .logo{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.2);
          display:flex;align-items:center;justify-content:center;font-size:20px}
    .brand-name{font-size:16px;font-weight:900;letter-spacing:1px}
    .brand-tag{font-size:11px;opacity:.7}
    .badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;
           background:rgba(22,163,74,.9);color:#fff;border-radius:20px;
           padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:.5px}
    .badge::before{content:'●';font-size:8px}
    .body{padding:20px}
    .row{display:flex;justify-content:space-between;margin-bottom:16px}
    .cell label{display:block;font-size:10px;font-weight:700;color:#94A3B8;
                text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
    .cell span{font-size:16px;font-weight:800;color:#1E293B}
    .divider{border:none;border-top:2px dashed #E2E8F0;margin:16px -20px}
    .qr-area{text-align:center;padding:16px 0}
    .qr-label{font-size:12px;color:#64748B;margin-bottom:12px;font-weight:600}
    .open-btn{display:block;width:100%;background:#2563EB;color:#fff;
              border:none;border-radius:14px;padding:16px;font-size:16px;
              font-weight:700;cursor:pointer;text-decoration:none;text-align:center;
              margin-top:8px;transition:opacity .15s}
    .open-btn:hover{opacity:.9}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#94A3B8;line-height:1.5}
    .valid-tag{background:#DCFCE7;color:#16A34A;border-radius:8px;
               padding:3px 8px;font-size:11px;font-weight:700}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <div class="brand">
        <div class="logo">🚌</div>
        <div>
          <div class="brand-name">YALLA TRANSIT</div>
          <div class="brand-tag">Official Digital Ticket</div>
        </div>
      </div>
      <div class="badge">CONFIRMED</div>
    </div>
    <div class="body">
      <div class="row">
        <div class="cell">
          <label>Booking ID</label>
          <span>#${payload.bid}</span>
        </div>
        <div class="cell" style="text-align:right">
          <label>Seat</label>
          <span style="color:#2563EB">${payload.seat}</span>
        </div>
      </div>
      <div class="row">
        <div class="cell">
          <label>Valid until</label>
          <span>${expDate}</span>
        </div>
        <div class="cell" style="text-align:right">
          <label>Status</label>
          <span class="valid-tag">✓ Valid</span>
        </div>
      </div>
      <hr class="divider">
      <div class="qr-area">
        <div class="qr-label">Open in Yalla Transit for full ticket details & live tracking</div>
        <a href="${deepLink}" class="open-btn">🚌 Open in Yalla Transit</a>
        <div style="margin-top:12px;font-size:11px;color:#94A3B8">
          Don't have the app? Download on the App Store or Google Play.
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    🔒 Secured by Yalla Transit &nbsp;·&nbsp; View-only link, cannot be used for boarding<br>
    Expires ${expDate}
  </div>
  <script>
    // Auto deep-link on mobile if app might be installed
    if (/android|iphone|ipad/i.test(navigator.userAgent)) {
      window.location.href = '${deepLink}';
      setTimeout(function() {}, 1500); // fallback: stay on page
    }
  </script>
</body>
</html>`;
};

const buildErrorHtml = (reason) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invalid Ticket — Yalla Transit</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#FEF2F2;min-height:100vh;
     display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:20px;max-width:360px;width:100%;padding:32px;
      text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1)}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:20px;font-weight:800;color:#1E293B;margin-bottom:8px}
p{font-size:14px;color:#64748B;line-height:1.6}</style></head>
<body><div class="card">
  <div class="icon">⚠️</div>
  <h1>${reason === 'expired' ? 'Link Expired' : 'Invalid Ticket Link'}</h1>
  <p>${reason === 'expired'
    ? 'This ticket link has expired. Ticket links are valid for 7 days after sharing.'
    : 'This ticket link is invalid or has been tampered with. Please request a fresh share link from the ticket holder.'
  }</p>
</div></body></html>`;

// ── GET /api/share/ticket?t=TOKEN  (public, rate-limited) ────────────────────
export const getSharedTicket = (req, res) => {
  const { t: token } = req.query;
  if (!token) return res.status(400).json({ error: 'Query param ?t is required' });

  const result     = verifyShareToken(token);
  const wantHtml   = req.accepts(['html', 'json']) === 'html';

  if (!result.valid) {
    const msg = result.reason === 'expired'
      ? 'This ticket link has expired (valid for 7 days after sharing).'
      : 'Invalid or tampered ticket link.';
    if (wantHtml) return res.status(401).send(buildErrorHtml(result.reason));
    return res.status(401).json({ valid: false, reason: result.reason, error: msg });
  }

  if (wantHtml) return res.send(buildTicketHtml(result.payload, token, req));

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
