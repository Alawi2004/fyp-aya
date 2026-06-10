import crypto from "crypto";

const QR_TOKEN_TTL_SECONDS = 60;
const QR_SIGNING_SECRET = process.env.PASSENGER_QR_SECRET || process.env.JWT_SECRET || "dev-qr-secret";

const encodeBase64Url = (value) => Buffer.from(value).toString("base64url");
const decodeBase64UrlJson = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

const sign = (input) =>
  crypto
    .createHmac("sha256", QR_SIGNING_SECRET)
    .update(input)
    .digest("base64url");

export const hashOpaqueToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const issuePassengerQrToken = (userId) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: String(userId),
    jti,
    iat: nowSeconds,
    exp: nowSeconds + QR_TOKEN_TTL_SECONDS,
    purpose: "passenger_boarding_qr",
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput);
  const token = `${signingInput}.${signature}`;

  return {
    token,
    tokenHash: hashOpaqueToken(token),
    jti,
    expiresAt: new Date(payload.exp * 1000),
    expiresInSeconds: QR_TOKEN_TTL_SECONDS,
    payload,
  };
};

export const verifyPassengerQrToken = (token) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "malformed" };
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  try {
    const header = decodeBase64UrlJson(encodedHeader);
    const payload = decodeBase64UrlJson(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (header.alg !== "HS256" || payload.purpose !== "passenger_boarding_qr") {
      return { valid: false, reason: "invalid_claims" };
    }
    if (!payload.exp || nowSeconds >= payload.exp) {
      return { valid: false, reason: "expired" };
    }
    if (!payload.jti || !payload.sub) {
      return { valid: false, reason: "invalid_claims" };
    }

    return {
      valid: true,
      payload,
      tokenHash: hashOpaqueToken(token),
    };
  } catch {
    return { valid: false, reason: "malformed" };
  }
};
