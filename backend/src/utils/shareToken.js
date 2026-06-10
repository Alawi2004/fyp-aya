import crypto from 'crypto';

const SHARE_SECRET  = process.env.SHARE_TOKEN_SECRET || 'yalla-share-secret-dev-2026';
const TOKEN_TTL     = 7 * 24 * 60 * 60; // 7 days in seconds
const SIG_LENGTH    = 32;               // hex chars

const sign = (data) =>
  crypto.createHmac('sha256', SHARE_SECRET).update(data).digest('hex').slice(0, SIG_LENGTH);

export const issueShareToken = (bookingId, userId, seatId) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    bid: String(bookingId),
    uid: String(userId),
    seat: String(seatId),
    iat: now,
    exp: now + TOKEN_TTL,
    purpose: 'ticket_share',
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt: new Date((now + TOKEN_TTL) * 1000).toISOString() };
};

export const verifyShareToken = (token) => {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return { valid: false, reason: 'malformed' };

    const payloadB64 = token.slice(0, dot);
    const sig        = token.slice(dot + 1);

    if (sig !== sign(payloadB64)) return { valid: false, reason: 'invalid_signature' };

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (payload.purpose !== 'ticket_share') return { valid: false, reason: 'wrong_purpose' };
    if (payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
};
