/**
 * Real-time GPS WebSocket Stream — Yalla Transit
 *
 * Provides a WebSocket server at /gps-stream for pushing live GPS
 * position updates and geofence events to connected clients.
 *
 * Protocol
 * ────────
 * Client → Server (subscription messages):
 *   { "type": "subscribe",     "vehicle_id": "BUS-01" }   subscribe to one vehicle
 *   { "type": "subscribe_all" }                            subscribe to all (admin)
 *   { "type": "unsubscribe"   }                            cancel all subscriptions
 *   { "type": "ping"          }                            keepalive
 *
 * Server → Client (push messages):
 *   { "type": "connected",     "message": "..." }          on open
 *   { "type": "subscribed",    "vehicle_id": "..." }       ack single-vehicle
 *   { "type": "subscribed",    "scope": "all" }            ack admin
 *   { "type": "gps_update",    ...gpsPayload }              live position
 *   { "type": "geofence_breach", ...breachPayload }         route deviation alert
 *   { "type": "pong" }                                     ping reply
 *
 * The server sends a WebSocket PING frame every 30 s to detect dead
 * connections — clients that do not respond are terminated.
 *
 * CORS: connections from any origin are accepted (native-app + browser).
 */

import { WebSocketServer } from "ws";

// Subscription maps
const _byVehicle = new Map();  // vehicle_id (string) → Set<WebSocket>
const _adminSubs = new Set();  // WebSockets subscribed to all events

let _wss = null;
let _heartbeat = null;

// ── Attachment ────────────────────────────────────────────────────────────────

/**
 * Attach the WebSocket server to an existing Node.js http.Server.
 * Call this once from server.js after creating the HTTP server. Calling it
 * again is a no-op (returns the existing server) so we never end up with
 * duplicate servers or heartbeat intervals.
 *
 * @param {import('http').Server} httpServer
 */
export function attachWebSocket(httpServer) {
  if (_wss) return _wss;   // already attached — avoid duplicate server + heartbeat

  _wss = new WebSocketServer({
    server: httpServer,
    path:   "/gps-stream",
    // Accept all origins — native apps don't send an Origin header
    // and the admin is on a known localhost port (harmless in dev).
    // In production restrict to known origins via verifyClient.
  });

  _wss.on("connection", _onConnection);

  // Heartbeat: ping every 30 s, terminate non-responding sockets.
  _heartbeat = setInterval(() => {
    for (const ws of _wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  _heartbeat.unref?.();   // don't keep the process alive just for the heartbeat

  // Clean up the heartbeat if the server is ever closed.
  _wss.on("close", () => {
    clearInterval(_heartbeat);
    _heartbeat = null;
    _wss = null;
  });

  console.log("[ws] GPS stream server attached at /gps-stream");
  return _wss;
}

// ── Connection handler ────────────────────────────────────────────────────────

function _onConnection(ws) {
  ws.isAlive  = true;
  ws.vehicleId = null;   // track which vehicle this client subscribed to

  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", raw => {
    try { _handleMessage(ws, JSON.parse(raw.toString())); } catch { /* ignore malformed */ }
  });

  ws.on("close", () => _cleanup(ws));
  ws.on("error", () => _cleanup(ws));

  _send(ws, { type: "connected", message: "Yalla Transit GPS stream ready" });
}

function _handleMessage(ws, msg) {
  switch (msg.type) {

    case "subscribe": {
      const vid = String(msg.vehicle_id ?? "");
      if (!vid) break;

      _cleanup(ws);   // remove any prior subscription
      ws.vehicleId = vid;
      if (!_byVehicle.has(vid)) _byVehicle.set(vid, new Set());
      _byVehicle.get(vid).add(ws);
      _send(ws, { type: "subscribed", vehicle_id: vid });
      break;
    }

    case "subscribe_all": {
      _cleanup(ws);
      _adminSubs.add(ws);
      ws.vehicleId = "__all__";
      _send(ws, { type: "subscribed", scope: "all" });
      break;
    }

    case "unsubscribe":
      _cleanup(ws);
      _send(ws, { type: "unsubscribed" });
      break;

    case "ping":
      _send(ws, { type: "pong" });
      break;
  }
}

function _cleanup(ws) {
  _adminSubs.delete(ws);
  if (ws.vehicleId && ws.vehicleId !== "__all__") {
    const set = _byVehicle.get(ws.vehicleId);
    if (set) { set.delete(ws); if (!set.size) _byVehicle.delete(ws.vehicleId); }
  }
  ws.vehicleId = null;
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

/**
 * Broadcast a GPS position update.
 * Delivers to:
 *   • clients subscribed to this specific vehicle
 *   • clients subscribed to all (admin)
 *
 * @param {object} payload – must include vehicle_id (string)
 */
export function broadcastGpsUpdate(payload) {
  const msg = JSON.stringify({ type: "gps_update", ...payload });
  const vid = String(payload.vehicle_id ?? payload.plate_number ?? "");
  const tid = payload.trip_id != null ? String(payload.trip_id) : null;

  // Plate-number subscribers (admin map screen)
  const subs = _byVehicle.get(vid);
  if (subs) for (const ws of subs) _sendRaw(ws, msg);

  // Trip-ID subscribers (passenger tracking screen)
  if (tid && tid !== vid) {
    const tripSubs = _byVehicle.get(tid);
    if (tripSubs) for (const ws of tripSubs) _sendRaw(ws, msg);
  }

  // Admin "all" subscribers
  for (const ws of _adminSubs) _sendRaw(ws, msg);
}

/**
 * Broadcast any named event (e.g. "geofence_breach") to all admin subscribers.
 *
 * @param {string} eventType
 * @param {object} payload
 */
export function broadcastEvent(eventType, payload) {
  if (!_adminSubs.size) return;
  const msg = JSON.stringify({ type: eventType, ...payload });
  for (const ws of _adminSubs) _sendRaw(ws, msg);
}

/** Returns number of currently connected clients (for health checks). */
export function connectedClients() {
  return _wss ? _wss.clients.size : 0;
}

// ── Private send ──────────────────────────────────────────────────────────────

function _send(ws, obj)    { _sendRaw(ws, JSON.stringify(obj)); }
function _sendRaw(ws, str) {
  if (ws.readyState === 1 /* OPEN */) ws.send(str);
}
