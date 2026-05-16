/**
 * Firebase Cloud Messaging (FCM) service — Yalla Transit
 *
 * Provides direct FCM delivery via the Firebase Admin SDK.
 * Used as a second delivery path alongside the existing Expo push service:
 *   • Expo tokens  (ExponentPushToken[...]) → expo-server-sdk
 *   • FCM tokens   (everything else)        → this service (firebase-admin)
 *
 * Configuration
 * ─────────────
 * Set ONE of these env vars:
 *
 *   FIREBASE_SERVICE_ACCOUNT   full service-account JSON as a string
 *                              (paste the entire contents of serviceAccount.json)
 *
 *   GOOGLE_APPLICATION_CREDENTIALS   path to serviceAccount.json on disk
 *                                    (firebase-admin picks this up automatically)
 *
 * When neither is set the service silently no-ops — Expo delivery still works.
 */

import admin from "firebase-admin";

let _app      = null;
let _disabled = false;   // stays true after the first failed init attempt

// ── Initialisation ────────────────────────────────────────────────────────────

function _init() {
  if (_app)      return _app;
  if (_disabled) return null;

  try {
    // Prefer inline JSON credential (good for cloud env vars)
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const credential = raw
      ? admin.credential.cert(JSON.parse(raw))
      : admin.credential.applicationDefault();   // falls back to GOOGLE_APPLICATION_CREDENTIALS

    _app = admin.initializeApp({ credential });
    console.log("[fcm] Firebase Admin SDK initialised");
    return _app;
  } catch (err) {
    _disabled = true;
    console.warn("[fcm] disabled —", err.message);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true for raw FCM / APNs tokens (not Expo-wrapped).
 * Expo tokens always start with "ExponentPushToken[".
 */
export function isFcmToken(token) {
  return typeof token === "string" && token.length > 0 &&
         !token.startsWith("ExponentPushToken[");
}

// ── Delivery ──────────────────────────────────────────────────────────────────

/**
 * Send a notification to one or more raw FCM / APNs tokens.
 * Batches into 500-token chunks (FCM multicast limit).
 * Fire-and-forget — logs warnings, never throws.
 *
 * @param {string[]} tokens   Raw device tokens
 * @param {string}   title
 * @param {string}   body
 * @param {object}   [data]   Key-value string payload forwarded to the app
 */
export async function fcmSend(tokens, title, body, data = {}) {
  if (!tokens.length) return;
  if (!_init())       return;   // FCM disabled

  const CHUNK = 500;
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: stringData,
        android: {
          priority: "high",
          notification: { channelId: "default", sound: "default" },
        },
        apns: {
          payload: { aps: { sound: "default" } },
        },
      });
    } catch (err) {
      console.warn("[fcm] multicast error:", err.message);
    }
  }
}

/**
 * Dual-dispatch helper used by notifications.controller.js and
 * geofencing.service.js.
 *
 * Splits a mixed array of push tokens into Expo vs FCM buckets and
 * dispatches each bucket through its native delivery channel.
 *
 * Returns { expoCount, fcmCount } for logging.
 */
export async function dispatchToTokens(allTokens, title, body, data = {}) {
  const { Expo } = await import("expo-server-sdk");
  const expo     = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

  const expoTokens = allTokens.filter(t => Expo.isExpoPushToken(t));
  const fcmTokens  = allTokens.filter(t => isFcmToken(t));

  const sends = [];

  if (expoTokens.length) {
    const messages = expoTokens.map(to => ({
      to, title, body, sound: "default", channelId: "default",
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      sends.push(expo.sendPushNotificationsAsync(chunk).catch(e => console.warn("[expo] chunk error:", e.message)));
    }
  }

  if (fcmTokens.length) {
    sends.push(fcmSend(fcmTokens, title, body, data));
  }

  await Promise.allSettled(sends);
  return { expoCount: expoTokens.length, fcmCount: fcmTokens.length };
}
