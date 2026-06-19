import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

const toFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const toInt   = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 ? n : null; };

// POST /api/taxi-reservations
export const createTaxiReservation = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const {
    vehicle_type, pickup_address, pickup_lat, pickup_lng,
    dest_address, dest_lat, dest_lng, distance_km, estimated_fare,
    driver_id, driver_name, scheduled_for, recurrence, notes, stops,
    preferred_gender,
  } = req.body;

  if (!vehicle_type || !pickup_address?.trim() || !dest_address?.trim()) {
    return res.status(400).json({ error: "vehicle_type, pickup_address, and dest_address are required" });
  }

  const preferredGender = preferred_gender && ['male', 'female'].includes(String(preferred_gender).toLowerCase())
    ? String(preferred_gender).toLowerCase()
    : null;

  const fare = Math.max(0, toFloat(estimated_fare) ?? 0);
  const stopsJson = Array.isArray(stops) && stops.length > 0
    ? JSON.stringify(stops)
    : null;
  const driverId = toInt(driver_id);

  const pool = await poolPromise;
  const tx = pool.transaction();

  try {
    await ensureOperationalTables(pool);

    // A female-driver request is only offered to female passengers — enforce it
    // server-side so the rule can't be bypassed by a crafted request.
    if (preferredGender) {
      const passengerRes = await pool.request()
        .input("uid", sql.Int, userId)
        .query("SELECT gender FROM users WHERE user_id = @uid");
      const passengerGender = passengerRes.recordset[0]?.gender?.toLowerCase() ?? null;
      if (preferredGender === 'female' && passengerGender !== 'female') {
        return res.status(403).json({ error: "Only female passengers can request a female driver." });
      }

      // If a specific driver was chosen, make sure they match the requested gender
      if (driverId) {
        const drvRes = await pool.request()
          .input("did", sql.Int, driverId)
          .query(`
            SELECT u.gender FROM drivers d
            JOIN users u ON u.user_id = d.user_id
            WHERE d.driver_id = @did AND ISNULL(d.is_deleted, 0) = 0
          `);
        const drvGender = drvRes.recordset[0]?.gender?.toLowerCase() ?? null;
        if (drvGender !== preferredGender) {
          return res.status(400).json({ error: "The selected driver does not match the requested gender." });
        }
      }
    }

    await tx.begin();

    // 1. Verify wallet exists, is not frozen, and has enough balance
    const walletResult = await tx.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance, is_frozen FROM wallets WHERE user_id = @uid");
    const wallet = walletResult.recordset[0];

    if (!wallet) {
      await tx.rollback();
      return res.status(400).json({ error: "Wallet not found. Please top up your wallet first." });
    }
    if (wallet.is_frozen) {
      await tx.rollback();
      return res.status(403).json({ error: "Your wallet is frozen — contact support." });
    }
    const currentBalance = parseFloat(wallet.balance);
    if (currentBalance < fare) {
      await tx.rollback();
      return res.status(402).json({
        error: `Insufficient balance. Your wallet has $${currentBalance.toFixed(2)} but the fare is $${fare.toFixed(2)}.`,
      });
    }

    // 2. Deduct fare from wallet
    await tx.request()
      .input("uid", sql.Int, userId)
      .input("amt", sql.Decimal(10, 2), fare)
      .query("UPDATE wallets SET balance = balance - @amt, updated_at = GETUTCDATE() WHERE user_id = @uid");

    // 3. Insert the reservation
    const result = await tx.request()
      .input("userId",        sql.Int,            userId)
      .input("vehicleType",   sql.NVarChar(20),   vehicle_type)
      .input("pickupAddress", sql.NVarChar(300),  pickup_address.trim())
      .input("pickupLat",     sql.Float,          toFloat(pickup_lat))
      .input("pickupLng",     sql.Float,          toFloat(pickup_lng))
      .input("destAddress",   sql.NVarChar(300),  dest_address.trim())
      .input("destLat",       sql.Float,          toFloat(dest_lat))
      .input("destLng",       sql.Float,          toFloat(dest_lng))
      .input("distanceKm",    sql.Float,          toFloat(distance_km))
      .input("estimatedFare", sql.Decimal(10, 2), fare)
      .input("driverId",      sql.Int,            driverId)
      .input("driverName",    sql.NVarChar(100),  driver_name ?? null)
      .input("scheduledFor",  sql.NVarChar(100),  scheduled_for ?? "Now")
      .input("recurrence",    sql.NVarChar(20),   recurrence ?? "once")
      .input("notes",         sql.NVarChar(500),  notes ?? null)
      .input("stopsJson",     sql.NVarChar(sql.MAX), stopsJson)
      .input("preferredGender", sql.NVarChar(10), preferredGender)
      .query(`
        INSERT INTO taxi_reservations
          (user_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
           dest_address, dest_lat, dest_lng, distance_km, estimated_fare,
           driver_id, driver_name, scheduled_for, recurrence, notes, stops_json,
           preferred_driver_gender)
        OUTPUT
          INSERTED.reservation_id, INSERTED.status, INSERTED.created_at,
          INSERTED.vehicle_type, INSERTED.pickup_address, INSERTED.dest_address,
          INSERTED.estimated_fare, INSERTED.scheduled_for, INSERTED.driver_name,
          INSERTED.distance_km, INSERTED.stops_json, INSERTED.preferred_driver_gender
        VALUES
          (@userId, @vehicleType, @pickupAddress, @pickupLat, @pickupLng,
           @destAddress, @destLat, @destLng, @distanceKm, @estimatedFare,
           @driverId, @driverName, @scheduledFor, @recurrence, @notes, @stopsJson,
           @preferredGender)
      `);

    // 4. Log the wallet debit
    await tx.request()
      .input("uid",  sql.Int, userId)
      .input("amt",  sql.Decimal(10, 2), fare)
      .input("desc", sql.NVarChar(500),
        `Taxi fare — ${pickup_address.trim()} → ${dest_address.trim()}`)
      .query(`
        INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
        VALUES (@uid, 'debit', @amt, @desc, GETUTCDATE())
      `);

    await tx.commit();

    const balanceResult = await pool.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance FROM wallets WHERE user_id = @uid");
    const newBalance = parseFloat(balanceResult.recordset[0]?.balance ?? 0);

    res.status(201).json({
      message:     "Reservation created",
      reservation: result.recordset[0],
      newBalance,
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[createTaxiReservation]", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
};

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// SOCS=CAI bypasses the Google consent/cookie-gate that intercepts server-side requests
const GOOGLE_COOKIES = 'SOCS=CAI; NID=; SID=';

const COORD = '(-?(?:1[0-7]\\d|\\d{1,2})\\.\\d+)';

const parseMapCoords = (text) => {
  // @lat,lng — standard share/place URL (most common)
  let m = text.match(new RegExp(`@${COORD},${COORD}`));
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // !3dlat!4dlng — directions / embed / data= field
  m = text.match(new RegExp(`!3d${COORD}!4d${COORD}`));
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // "lat":X,"lng":Y or "latitude":X,"longitude":Y — JSON in HTML
  m = text.match(/"lat(?:itude)?":(-?\d{1,3}\.\d+),"lng|lon(?:gitude)?":(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // ?q=, ?center=, ?ll=, ?query= carrying numeric coords
  m = text.match(/[?&](?:q|center|ll|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
};

const nominatimGeocode = async (query) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FYP-AYA Transit App (student project)', 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
};

// GET /api/taxi-reservations/expand-map?url=...
// Server-side URL expansion — bypasses Google bot-detection and consent pages.
export const expandMapUrl = async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  // Step 1: parse the raw URL directly (full google.com/maps links with @lat,lng work here)
  const direct = parseMapCoords(url);
  if (direct) return res.json(direct);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':                DESKTOP_UA,
        'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':           'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
        'Cookie':                    GOOGLE_COOKIES,
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    // Step 2: check the fully-resolved URL after all HTTP redirects
    const fromFinal = parseMapCoords(response.url ?? '');
    if (fromFinal) return res.json(fromFinal);

    // Step 3: scan the HTML body for embedded coordinate data
    const html = await response.text();
    const fromHtml = parseMapCoords(html);
    if (fromHtml) return res.json(fromHtml);

    // Step 4: extract place name from HTML <title> and geocode via Nominatim
    const titleMatch = html.match(/<title[^>]*>([^<]+?)\s*[-–|]\s*Google Maps/i);
    if (titleMatch) {
      const placeName = titleMatch[1].trim();
      if (placeName) {
        const geocoded = await nominatimGeocode(placeName);
        if (geocoded) return res.json(geocoded);
      }
    }

    return res.status(422).json({ error: 'Could not extract coordinates from this URL' });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out expanding URL' });
    }
    console.error('[expandMapUrl]', err.message);
    return res.status(500).json({ error: 'Failed to expand URL', detail: err.message });
  }
};

// DELETE /api/taxi-reservations/:id — cancel a reservation and refund wallet
export const cancelTaxiReservation = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const reservationId = parseInt(req.params.id, 10);
  if (!reservationId) return res.status(400).json({ error: "Invalid reservation id" });

  const pool = await poolPromise;
  const tx = pool.transaction();

  try {
    await tx.begin();

    const resResult = await tx.request()
      .input("id",  sql.Int, reservationId)
      .input("uid", sql.Int, userId)
      .query("SELECT reservation_id, user_id, status, estimated_fare FROM taxi_reservations WHERE reservation_id = @id");
    const reservation = resResult.recordset[0];

    if (!reservation) {
      await tx.rollback();
      return res.status(404).json({ error: "Reservation not found" });
    }
    if (reservation.user_id !== userId) {
      await tx.rollback();
      return res.status(403).json({ error: "You can only cancel your own reservations" });
    }
    if (reservation.status === "cancelled") {
      await tx.rollback();
      return res.status(409).json({ error: "Reservation is already cancelled" });
    }
    if (reservation.status === "completed") {
      await tx.rollback();
      return res.status(409).json({ error: "Completed reservations cannot be cancelled" });
    }

    await tx.request()
      .input("id", sql.Int, reservationId)
      .query("UPDATE taxi_reservations SET status = 'cancelled' WHERE reservation_id = @id");

    const refund = parseFloat(reservation.estimated_fare ?? 0);
    if (refund > 0) {
      await tx.request()
        .input("uid", sql.Int, userId)
        .input("amt", sql.Decimal(10, 2), refund)
        .query("UPDATE wallets SET balance = balance + @amt, updated_at = GETUTCDATE() WHERE user_id = @uid");

      await tx.request()
        .input("uid",  sql.Int, userId)
        .input("amt",  sql.Decimal(10, 2), refund)
        .input("desc", sql.NVarChar(500), `Refund — cancelled taxi reservation #${reservationId}`)
        .query(`
          INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
          VALUES (@uid, 'credit', @amt, @desc, GETUTCDATE())
        `);
    }

    await tx.commit();

    const balanceResult = await pool.request()
      .input("uid", sql.Int, userId)
      .query("SELECT balance FROM wallets WHERE user_id = @uid");
    const newBalance = parseFloat(balanceResult.recordset[0]?.balance ?? 0);

    res.json({ message: "Reservation cancelled", refund, newBalance });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[cancelTaxiReservation]", err);
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
};

// GET /api/taxi-reservations — passenger's own reservations
export const getMyTaxiReservations = async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT
          tr.reservation_id,
          tr.vehicle_type,
          tr.pickup_address,
          tr.dest_address,
          tr.distance_km,
          CAST(tr.estimated_fare AS FLOAT) AS estimated_fare,
          tr.driver_id,
          tr.driver_name,
          tr.scheduled_for,
          tr.recurrence,
          tr.notes,
          tr.preferred_driver_gender,
          tr.status,
          tr.created_at,
          v.plate_number,
          v.color  AS vehicle_color,
          v.model  AS vehicle_model,
          ROUND(AVG(CAST(r.rating AS FLOAT)), 1) AS driver_rating
        FROM taxi_reservations tr
        LEFT JOIN (
          SELECT driver_id, MAX(vehicle_id) AS vehicle_id
          FROM trips WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL
          GROUP BY driver_id
        ) lv ON lv.driver_id = tr.driver_id
        LEFT JOIN vehicles v ON v.vehicle_id = lv.vehicle_id
        LEFT JOIN trips t2   ON t2.driver_id = tr.driver_id
        LEFT JOIN ratings r  ON r.trip_id    = t2.trip_id
        WHERE tr.user_id = @userId
        GROUP BY
          tr.reservation_id, tr.vehicle_type, tr.pickup_address, tr.dest_address,
          tr.distance_km, tr.estimated_fare, tr.driver_id, tr.driver_name,
          tr.scheduled_for, tr.recurrence, tr.notes, tr.preferred_driver_gender,
          tr.status, tr.created_at,
          v.plate_number, v.color, v.model
        ORDER BY tr.reservation_id DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("[getMyTaxiReservations]", err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
};
