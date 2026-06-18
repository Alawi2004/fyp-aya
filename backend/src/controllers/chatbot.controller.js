import OpenAI from "openai";
import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

// ── Azure AI Foundry client ───────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey:       process.env.AZURE_OPENAI_KEY,
  baseURL:      process.env.AZURE_OPENAI_ENDPOINT,
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview" },
});
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1-mini";

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  // ── Existing tools ──────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description: "Returns the passenger's current wallet balance and frozen status.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trip_history",
      description: "Returns the passenger's recent trip/booking history.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max trips to return (1-10, default 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_ticket",
      description: "Returns the passenger's most recent active/valid ticket and its QR status.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_routes",
      description: "Searches routes by name, start location, or end location keyword.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword e.g. 'Hamra', 'Jounieh', 'Route 12'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_route_stops",
      description: "Lists all stops for a specific route in order.",
      parameters: {
        type: "object",
        properties: {
          route_id: { type: "integer", description: "The route_id from search_routes" },
        },
        required: ["route_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_next_departures",
      description: "Gets upcoming scheduled trips that pass through or start near a given stop name.",
      parameters: {
        type: "object",
        properties: {
          stop_name: { type: "string", description: "Stop name to search for e.g. 'Hamra'" },
          limit:     { type: "integer", description: "Max results (default 3)" },
        },
        required: ["stop_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fare_info",
      description: "Returns fare zone information (base fare) for a route, plus the per-km rate from settings.",
      parameters: {
        type: "object",
        properties: {
          route_id: { type: "integer", description: "The route_id to get fare info for" },
        },
        required: ["route_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_live_bus_location",
      description: "Returns the most recent GPS location for the passenger's active trip, if any.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "file_complaint",
      description: "Files a complaint on behalf of the passenger. For lost items use category='lost'. For incidents use priority='high'. Always confirm details with the user before calling.",
      parameters: {
        type: "object",
        properties: {
          title:       { type: "string", description: "Short complaint title (max 200 chars)" },
          description: { type: "string", description: "Full description of the issue" },
          category: {
            type: "string",
            enum: ["delay", "driver", "vehicle", "cleanliness", "overcharge", "safety", "lost", "other"],
            description: "Complaint category",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Priority level (default medium)",
          },
          trip_id: { type: "integer", description: "Optional trip_id to attach to the complaint" },
        },
        required: ["title", "description", "category"],
      },
    },
  },

  // ── New tools ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_upcoming_bookings",
      description: "Returns the passenger's upcoming bookings (future trips with active tickets) that can potentially be cancelled.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancels a ticket by ticket_id. Only cancels tickets that belong to the authenticated user and have a future trip. Refunds the ticket amount to the user's wallet.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "integer", description: "The ticket_id to cancel (from get_upcoming_bookings)" },
        },
        required: ["ticket_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_seat_availability",
      description: "Checks available seats on upcoming trips matching a route or destination query.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Route name, start, or destination to search for e.g. 'Jounieh', 'Route 5'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_completed_trips",
      description: "Returns the passenger's recently completed trips, including whether each has been rated already.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max trips to return (1-5, default 3)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_rating",
      description: "Submits a star rating and optional comment for a completed trip. Call get_completed_trips first to find the trip_id. Only call after user confirms their rating.",
      parameters: {
        type: "object",
        properties: {
          trip_id: { type: "integer", description: "The trip_id to rate" },
          stars:   { type: "integer", description: "Star rating 1-5" },
          comment: { type: "string",  description: "Optional comment" },
        },
        required: ["trip_id", "stars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_transactions",
      description: "Returns recent wallet transactions (top-ups, deductions, refunds) to explain a charge or credit.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max transactions to return (1-20, default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_up_locations",
      description: "Returns top-up agent locations sorted by distance from the user if GPS is available, otherwise sorted by city/name. Use this when the user asks where to reload their wallet.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "Optional city filter e.g. 'Beirut', 'Jounieh'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stops",
      description: "Searches bus stops by name or address keyword. Use this to disambiguate when a user mentions a vague place name (e.g. 'airport', 'university', 'hospital') — find all matching stops and present the options to the user before taking any action.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Stop name or address keyword e.g. 'airport', 'AUB', 'Cola'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_nearby_stops",
      description: "Returns bus stops closest to the user's current GPS location. Call this when the user asks about nearby stops, nearest bus, or 'where can I catch a bus near me'. Uses the user's live location — no parameters needed.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_passenger_demand",
      description: "Returns historical passenger demand by hour of day for a route, helping suggest the best (least crowded) time to travel.",
      parameters: {
        type: "object",
        properties: {
          route_id: { type: "integer", description: "The route_id to analyze (use search_routes first)" },
        },
        required: ["route_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_multi_stop_trip",
      description: "Plans a trip from an origin to a destination, returning direct routes and 1-transfer connecting options.",
      parameters: {
        type: "object",
        properties: {
          from_query: { type: "string", description: "Origin stop or area name e.g. 'Hamra'" },
          to_query:   { type: "string", description: "Destination stop or area name e.g. 'Jounieh'" },
        },
        required: ["from_query", "to_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "initiate_taxi_booking",
      description: "Opens the taxi booking form pre-filled with the pickup and destination the user mentioned. Call this when the user wants to book a private taxi ride.",
      parameters: {
        type: "object",
        properties: {
          pickup:      { type: "string", description: "Pickup address or location" },
          destination: { type: "string", description: "Destination address or location" },
          time:        { type: "string", description: "Optional requested time e.g. '15:00', 'tomorrow morning'" },
          notes:       { type: "string", description: "Optional notes for the driver" },
        },
        required: ["pickup", "destination"],
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────
// ctx = { userId, pool, actionRef }  (actionRef.current is set for frontend actions)
async function executeTool(name, args, ctx) {
  const { userId, pool, actionRef } = ctx;

  switch (name) {
    // ── Wallet balance ──────────────────────────────────────────────────────
    case "get_wallet_balance": {
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .query("SELECT balance, is_frozen, freeze_reason FROM wallets WHERE user_id = @uid");
      const row = r.recordset[0];
      if (!row) return { balance: 0, is_frozen: false };
      return {
        balance:       parseFloat(row.balance),
        is_frozen:     !!row.is_frozen,
        freeze_reason: row.freeze_reason ?? null,
      };
    }

    // ── Trip history ────────────────────────────────────────────────────────
    case "get_trip_history": {
      const limit = Math.min(10, Math.max(1, parseInt(args.limit ?? 5, 10)));
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .input("top", sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            tk.ticket_id, tk.status AS ticket_status, tk.amount, tk.booking_time,
            r.route_name, r.start_location, r.end_location,
            tr.start_time, tr.status AS trip_status
          FROM tickets tk
          JOIN trips  tr ON tr.trip_id  = tk.trip_id
          JOIN routes r  ON r.route_id  = tr.route_id
          WHERE tk.user_id = @uid
          ORDER BY tk.booking_time DESC
        `);
      return { trips: r.recordset };
    }

    // ── Active ticket ───────────────────────────────────────────────────────
    case "get_active_ticket": {
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT TOP 1
            tk.ticket_id, tk.status, tk.seat_number, tk.amount, tk.booking_time,
            r.route_name, r.start_location, r.end_location,
            tr.start_time, tr.status AS trip_status
          FROM tickets tk
          JOIN trips  tr ON tr.trip_id = tk.trip_id
          JOIN routes r  ON r.route_id = tr.route_id
          WHERE tk.user_id = @uid
            AND tk.status IN ('active','paid','valid','booked')
          ORDER BY tk.booking_time DESC
        `);
      if (!r.recordset.length) return { ticket: null };
      return { ticket: r.recordset[0] };
    }

    // ── Search routes ───────────────────────────────────────────────────────
    case "search_routes": {
      const q = `%${(args.query ?? "").trim()}%`;
      const r = await pool.request()
        .input("q", sql.NVarChar(200), q)
        .query(`
          SELECT route_id, route_name, start_location, end_location
          FROM routes
          WHERE is_deleted = 0
            AND (route_name LIKE @q OR start_location LIKE @q OR end_location LIKE @q)
          ORDER BY route_name
        `);
      return { routes: r.recordset };
    }

    // ── Route stops ─────────────────────────────────────────────────────────
    case "get_route_stops": {
      const r = await pool.request()
        .input("rid", sql.Int, args.route_id)
        .query(`
          SELECT s.stop_name, s.latitude, s.longitude, rs.stop_order
          FROM route_stops rs
          JOIN stops s ON s.stop_id = rs.stop_id
          WHERE rs.route_id = @rid AND s.is_deleted = 0
          ORDER BY rs.stop_order
        `);
      return { stops: r.recordset };
    }

    // ── Next departures ─────────────────────────────────────────────────────
    case "get_next_departures": {
      const limit = Math.min(5, Math.max(1, parseInt(args.limit ?? 3, 10)));
      const sq    = `%${(args.stop_name ?? "").trim()}%`;
      const r = await pool.request()
        .input("sq",  sql.NVarChar(200), sq)
        .input("top", sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            tr.trip_id, tr.start_time, tr.status,
            r.route_name, r.start_location, r.end_location
          FROM trips tr
          JOIN routes r ON r.route_id = tr.route_id
          WHERE tr.status IN ('scheduled','active')
            AND tr.start_time >= GETUTCDATE()
            AND r.route_id IN (
              SELECT rs.route_id
              FROM route_stops rs
              JOIN stops s ON s.stop_id = rs.stop_id
              WHERE s.stop_name LIKE @sq AND s.is_deleted = 0
            )
          ORDER BY tr.start_time ASC
        `);
      return { departures: r.recordset };
    }

    // ── Fare info ───────────────────────────────────────────────────────────
    case "get_fare_info": {
      const [zonesRes, rateRes, routeRes] = await Promise.all([
        pool.request()
          .input("rid", sql.Int, args.route_id)
          .query("SELECT zone_name, base_fare FROM fare_zones WHERE route_id = @rid ORDER BY base_fare ASC"),
        pool.request()
          .query("SELECT setting_value FROM system_settings WHERE setting_key = 'fare.per_km_rate'"),
        pool.request()
          .input("rid", sql.Int, args.route_id)
          .query("SELECT route_name, start_location, end_location FROM routes WHERE route_id = @rid"),
      ]);
      return {
        route:       routeRes.recordset[0] ?? null,
        fare_zones:  zonesRes.recordset,
        per_km_rate: parseFloat(rateRes.recordset[0]?.setting_value ?? "0"),
      };
    }

    // ── Live GPS ────────────────────────────────────────────────────────────
    case "get_live_bus_location": {
      const tripRes = await pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT TOP 1 tr.trip_id
          FROM tickets tk
          JOIN trips tr ON tr.trip_id = tk.trip_id
          WHERE tk.user_id = @uid
            AND tr.status IN ('active','ongoing')
          ORDER BY tk.booking_time DESC
        `);
      if (!tripRes.recordset.length) return { location: null, reason: "No active trip found" };

      const tripId = tripRes.recordset[0].trip_id;
      const gpsRes = await pool.request()
        .input("tid", sql.Int, tripId)
        .query(`
          SELECT TOP 1 latitude, longitude, recorded_at
          FROM gps_logs
          WHERE trip_id = @tid
          ORDER BY recorded_at DESC
        `);
      if (!gpsRes.recordset.length) return { location: null, reason: "No GPS signal yet" };

      const loc = gpsRes.recordset[0];
      return {
        trip_id:     tripId,
        latitude:    parseFloat(loc.latitude),
        longitude:   parseFloat(loc.longitude),
        recorded_at: loc.recorded_at,
      };
    }

    // ── File complaint (incl. lost items & incidents) ────────────────────────
    case "file_complaint": {
      await ensureOperationalTables(pool);
      const stamp    = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand     = Math.random().toString(36).slice(2, 8).toUpperCase();
      const code     = `CMP-${stamp}-${rand}`;
      const priority = args.priority ?? "medium";
      const tripId   = Number.isInteger(args.trip_id) && args.trip_id > 0 ? args.trip_id : null;

      await pool.request()
        .input("code",   sql.NVarChar(30),      code)
        .input("uid",    sql.Int,               userId)
        .input("title",  sql.NVarChar(200),     String(args.title).slice(0, 200))
        .input("desc",   sql.NVarChar(sql.MAX), String(args.description))
        .input("cat",    sql.NVarChar(50),      args.category)
        .input("pri",    sql.NVarChar(20),      priority)
        .input("tid",    sql.Int,               tripId)
        .query(`
          INSERT INTO complaints
            (tracking_code, submitted_by_user_id, title, description,
             category, priority, status, submitted_at, last_updated_at)
          VALUES
            (@code, @uid, @title, @desc,
             @cat, @pri, 'submitted', GETUTCDATE(), GETUTCDATE())
        `);
      return { success: true, tracking_code: code };
    }

    // ── Upcoming bookings (cancellable) ─────────────────────────────────────
    case "get_upcoming_bookings": {
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT TOP 10
            tk.ticket_id, tk.status AS ticket_status, tk.amount, tk.booking_time, tk.seat_number,
            r.route_name, r.start_location, r.end_location,
            tr.trip_id, tr.start_time, tr.status AS trip_status
          FROM tickets tk
          JOIN trips  tr ON tr.trip_id  = tk.trip_id
          JOIN routes r  ON r.route_id  = tr.route_id
          WHERE tk.user_id = @uid
            AND tr.start_time > GETUTCDATE()
            AND tk.status NOT IN ('cancelled','used','expired')
          ORDER BY tr.start_time ASC
        `);
      return { bookings: r.recordset };
    }

    // ── Cancel booking ──────────────────────────────────────────────────────
    case "cancel_booking": {
      const ticketId = parseInt(args.ticket_id, 10);
      if (!Number.isInteger(ticketId) || ticketId < 1) {
        return { success: false, error: "Invalid ticket_id" };
      }

      // Verify ownership and that trip is in the future
      const checkRes = await pool.request()
        .input("tid", sql.Int, ticketId)
        .input("uid", sql.Int, userId)
        .query(`
          SELECT tk.ticket_id, tk.status, tk.amount, tr.start_time
          FROM tickets tk
          JOIN trips tr ON tr.trip_id = tk.trip_id
          WHERE tk.ticket_id = @tid AND tk.user_id = @uid
        `);

      if (!checkRes.recordset.length) {
        return { success: false, error: "Ticket not found or does not belong to you" };
      }

      const ticket = checkRes.recordset[0];
      if (ticket.status === "cancelled") {
        return { success: false, error: "This ticket is already cancelled" };
      }
      if (new Date(ticket.start_time) <= new Date()) {
        return { success: false, error: "Cannot cancel a ticket for a trip that has already started or passed" };
      }

      const amount = parseFloat(ticket.amount);

      // Cancel the ticket and refund wallet in sequence (no transaction needed for this simple case)
      await pool.request()
        .input("tid", sql.Int, ticketId)
        .input("uid", sql.Int, userId)
        .query("UPDATE tickets SET status = 'cancelled' WHERE ticket_id = @tid AND user_id = @uid");

      if (amount > 0) {
        await pool.request()
          .input("uid", sql.Int,          userId)
          .input("amt", sql.Decimal(10,2), amount)
          .query("UPDATE wallets SET balance = balance + @amt, updated_at = GETUTCDATE() WHERE user_id = @uid");
      }

      return { success: true, ticket_id: ticketId, refunded_amount: amount };
    }

    // ── Seat availability ───────────────────────────────────────────────────
    case "get_seat_availability": {
      const q = `%${(args.query ?? "").trim()}%`;
      const r = await pool.request()
        .input("q", sql.NVarChar(200), q)
        .query(`
          SELECT TOP 5
            tr.trip_id, tr.start_time, tr.status,
            r.route_name, r.start_location, r.end_location,
            ISNULL(v.capacity, 40) AS capacity,
            (
              SELECT COUNT(*) FROM tickets tk
              WHERE tk.trip_id = tr.trip_id
                AND tk.status NOT IN ('cancelled','expired')
            ) AS booked_seats
          FROM trips tr
          JOIN routes  r ON r.route_id  = tr.route_id
          LEFT JOIN vehicles v ON v.vehicle_id = tr.vehicle_id
          WHERE tr.status IN ('scheduled','active')
            AND tr.start_time >= GETUTCDATE()
            AND (r.route_name LIKE @q OR r.start_location LIKE @q OR r.end_location LIKE @q)
          ORDER BY tr.start_time ASC
        `);
      const trips = r.recordset.map(row => ({
        ...row,
        available_seats: Math.max(0, row.capacity - row.booked_seats),
      }));
      return { trips };
    }

    // ── Completed trips (for rating) ────────────────────────────────────────
    case "get_completed_trips": {
      const limit = Math.min(5, Math.max(1, parseInt(args.limit ?? 3, 10)));
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .input("top", sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            tk.ticket_id, tk.trip_id, tk.amount, tk.booking_time,
            r.route_name, r.start_location, r.end_location,
            tr.start_time, tr.end_time,
            CASE WHEN EXISTS (
              SELECT 1 FROM ratings rt WHERE rt.trip_id = tk.trip_id AND rt.user_id = @uid
            ) THEN 1 ELSE 0 END AS already_rated
          FROM tickets tk
          JOIN trips  tr ON tr.trip_id  = tk.trip_id
          JOIN routes r  ON r.route_id  = tr.route_id
          WHERE tk.user_id = @uid
            AND tr.status IN ('completed','done','finished')
          ORDER BY tr.start_time DESC
        `);
      return { trips: r.recordset };
    }

    // ── Submit rating ───────────────────────────────────────────────────────
    case "submit_rating": {
      const tripId = parseInt(args.trip_id, 10);
      const stars  = Math.min(5, Math.max(1, parseInt(args.stars, 10)));

      if (!Number.isInteger(tripId) || tripId < 1) {
        return { success: false, error: "Invalid trip_id" };
      }

      // Verify the user has a ticket for this trip
      const ticketCheck = await pool.request()
        .input("tid", sql.Int, tripId)
        .input("uid", sql.Int, userId)
        .query("SELECT TOP 1 ticket_id FROM tickets WHERE trip_id = @tid AND user_id = @uid");

      if (!ticketCheck.recordset.length) {
        return { success: false, error: "No ticket found for this trip" };
      }

      // Check if already rated
      const ratingCheck = await pool.request()
        .input("tid", sql.Int, tripId)
        .input("uid", sql.Int, userId)
        .query("SELECT TOP 1 rating_id FROM ratings WHERE trip_id = @tid AND user_id = @uid");

      if (ratingCheck.recordset.length) {
        return { success: false, error: "You have already rated this trip" };
      }

      const ins = await pool.request()
        .input("uid",     sql.Int,               userId)
        .input("tid",     sql.Int,               tripId)
        .input("stars",   sql.Int,               stars)
        .input("comment", sql.NVarChar(sql.MAX), args.comment ?? null)
        .query(`
          INSERT INTO ratings (user_id, trip_id, rating, comment)
          OUTPUT INSERTED.rating_id
          VALUES (@uid, @tid, @stars, @comment)
        `);

      return { success: true, rating_id: ins.recordset[0]?.rating_id };
    }

    // ── Wallet transactions ─────────────────────────────────────────────────
    case "get_wallet_transactions": {
      const limit = Math.min(20, Math.max(1, parseInt(args.limit ?? 10, 10)));
      const r = await pool.request()
        .input("uid", sql.Int, userId)
        .input("top", sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            transaction_id, type, amount, description, created_at
          FROM wallet_transactions
          WHERE user_id = @uid
          ORDER BY created_at DESC
        `);
      return { transactions: r.recordset };
    }

    // ── Top-up locations (sorted by distance if GPS available) ─────────────
    case "get_top_up_locations": {
      const city = args.city ? `%${args.city.trim()}%` : null;
      const r = await pool.request()
        .input("city", sql.NVarChar(100), city)
        .query(`
          SELECT location_id, name, address, city, phone, hours
          FROM top_up_locations
          WHERE is_active = 1
            AND (@city IS NULL OR city LIKE @city)
          ORDER BY city, name
        `);

      // If user's GPS is available, compute distances client-side and sort
      const locations = r.recordset;
      if (ctx.location) {
        const { latitude: uLat, longitude: uLng } = ctx.location;
        // top_up_locations has no lat/lng columns — we can't sort by exact distance,
        // but we indicate the user's city context so the model can mention it
        return {
          locations,
          user_location: { latitude: uLat, longitude: uLng },
          note: "User location available — prioritise locations in their city when responding.",
        };
      }
      return { locations };
    }

    // ── Search stops by name/address ────────────────────────────────────────
    case "search_stops": {
      const q = `%${(args.query ?? "").trim()}%`;
      const r = await pool.request()
        .input("q", sql.NVarChar(200), q)
        .query(`
          SELECT stop_id, stop_name, address, latitude, longitude
          FROM stops
          WHERE is_deleted = 0
            AND (stop_name LIKE @q OR address LIKE @q)
          ORDER BY stop_name
        `);
      return { stops: r.recordset, count: r.recordset.length };
    }

    // ── Nearby stops (requires user GPS) ───────────────────────────────────
    case "get_nearby_stops": {
      if (!ctx.location) {
        return {
          no_gps: true,
          suggestion: "Ask the user which area or neighbourhood they are in, then use get_next_departures or search_routes with that area name as the query instead.",
        };
      }
      const { latitude, longitude } = ctx.location;
      const r = await pool.request()
        .input("lat", sql.Float, latitude)
        .input("lng", sql.Float, longitude)
        .query(`
          SELECT TOP 8
            stop_id, stop_name, address,
            latitude, longitude,
            ROUND(
              6371 * ACOS(
                COS(RADIANS(@lat)) * COS(RADIANS(latitude))
                * COS(RADIANS(longitude) - RADIANS(@lng))
                + SIN(RADIANS(@lat)) * SIN(RADIANS(latitude))
              ), 2
            ) AS distance_km
          FROM stops
          WHERE is_deleted = 0
            AND latitude  IS NOT NULL
            AND longitude IS NOT NULL
          ORDER BY distance_km ASC
        `);
      return { stops: r.recordset, user_location: ctx.location };
    }

    // ── Passenger demand by hour ────────────────────────────────────────────
    case "get_passenger_demand": {
      const routeId = parseInt(args.route_id, 10);
      if (!Number.isInteger(routeId) || routeId < 1) {
        return { error: "Invalid route_id" };
      }
      const r = await pool.request()
        .input("rid", sql.Int, routeId)
        .query(`
          SELECT
            DATEPART(HOUR, pc.recorded_at) AS hour_of_day,
            CAST(AVG(CAST(pc.passenger_count AS FLOAT)) AS DECIMAL(5,1)) AS avg_passengers,
            COUNT(*) AS sample_count
          FROM passenger_counts pc
          JOIN trips tr ON tr.trip_id = pc.trip_id
          WHERE tr.route_id = @rid
            AND pc.recorded_at >= DATEADD(DAY, -30, GETUTCDATE())
          GROUP BY DATEPART(HOUR, pc.recorded_at)
          ORDER BY hour_of_day
        `);
      return { demand_by_hour: r.recordset };
    }

    // ── Multi-stop trip planning ────────────────────────────────────────────
    case "plan_multi_stop_trip": {
      const fromQ = `%${(args.from_query ?? "").trim()}%`;
      const toQ   = `%${(args.to_query   ?? "").trim()}%`;

      // Direct routes serving both from and to
      const directRes = await pool.request()
        .input("fromQ", sql.NVarChar(200), fromQ)
        .input("toQ",   sql.NVarChar(200), toQ)
        .query(`
          SELECT DISTINCT r.route_id, r.route_name, r.start_location, r.end_location
          FROM routes r
          WHERE r.is_deleted = 0
            AND r.route_id IN (
              SELECT rs.route_id FROM route_stops rs
              JOIN stops s ON s.stop_id = rs.stop_id
              WHERE (s.stop_name LIKE @fromQ OR r.start_location LIKE @fromQ)
                AND s.is_deleted = 0
            )
            AND r.route_id IN (
              SELECT rs.route_id FROM route_stops rs
              JOIN stops s ON s.stop_id = rs.stop_id
              WHERE (s.stop_name LIKE @toQ OR r.end_location LIKE @toQ)
                AND s.is_deleted = 0
            )
        `);

      // Routes from origin (leg A)
      const fromRes = await pool.request()
        .input("fromQ", sql.NVarChar(200), fromQ)
        .query(`
          SELECT DISTINCT r.route_id, r.route_name, r.start_location, r.end_location
          FROM routes r
          WHERE r.is_deleted = 0
            AND (r.start_location LIKE @fromQ OR r.route_id IN (
              SELECT rs.route_id FROM route_stops rs
              JOIN stops s ON s.stop_id = rs.stop_id
              WHERE s.stop_name LIKE @fromQ AND s.is_deleted = 0
            ))
        `);

      // Routes to destination (leg B)
      const toRes = await pool.request()
        .input("toQ", sql.NVarChar(200), toQ)
        .query(`
          SELECT DISTINCT r.route_id, r.route_name, r.start_location, r.end_location
          FROM routes r
          WHERE r.is_deleted = 0
            AND (r.end_location LIKE @toQ OR r.route_id IN (
              SELECT rs.route_id FROM route_stops rs
              JOIN stops s ON s.stop_id = rs.stop_id
              WHERE s.stop_name LIKE @toQ AND s.is_deleted = 0
            ))
        `);

      return {
        direct_routes:  directRes.recordset,
        routes_from_origin: fromRes.recordset.slice(0, 5),
        routes_to_destination: toRes.recordset.slice(0, 5),
        note: directRes.recordset.length === 0
          ? "No direct route found. Consider a route from the origin routes to a common stop, then transfer to a destination route."
          : null,
      };
    }

    // ── Initiate taxi booking (frontend action) ─────────────────────────────
    case "initiate_taxi_booking": {
      actionRef.current = {
        type:        "open_taxi_booking",
        pickup:      args.pickup ?? "",
        destination: args.destination ?? "",
        time:        args.time ?? null,
        notes:       args.notes ?? null,
      };
      return {
        success: true,
        message: `Opening the taxi booking form pre-filled with: from "${args.pickup}" to "${args.destination}"${args.time ? ` at ${args.time}` : ""}.`,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(user, location) {
  const locationCtx = location
    ? `- GPS coordinates: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : `- GPS: coordinates not yet received — still call get_nearby_stops if the user asks for nearby stops/buses; the tool will handle it`;

  return `You are Yalla Transit AI — a smart, friendly assistant built into the passenger mobile app for a Lebanese public transit system.

## Who you are
You have full access to real-time data via tools. Never guess or make up route names, times, balances, or IDs — always call the right tool first and answer from its result. If a tool returns no data, say so honestly.

## User context
- Name: ${user.full_name ?? user.email}
- User ID: ${user.user_id}
${locationCtx}

## RULE 0 — Disambiguate before acting (MOST IMPORTANT)
Whenever the user mentions a place, stop, area, or destination by name (e.g. "airport", "university", "Cola", "downtown"):
1. **Always call search_stops AND search_routes** with that name first.
2. If **0 results**: tell the user you didn't find that place and ask them to rephrase.
3. If **1 result**: state what you found and ask "Is this the right place?" before proceeding.
4. If **2+ results**: list all options and ask "Which one did you mean?" — number them so the user can just reply with a number.
5. **Only after the user confirms** the exact stop/route, proceed with the actual action.

Example:
User: "I want to go to the airport"
Wrong: immediately calling initiate_taxi_booking with destination="airport"
Right: search_stops("airport") → find results → "I found these options:\n1. Beirut Rafic Hariri International Airport (Khaldeh)\n2. Airport Road Stop\nWhich one do you mean?"

## Tool selection rules
| User intent | Tool(s) to call |
|---|---|
| Balance / is wallet frozen | get_wallet_balance |
| Recent trips | get_trip_history |
| Active ticket / QR valid? | get_active_ticket |
| Find a route / what routes go to X | **search_stops(X) + search_routes(X)** → disambiguate → then proceed |
| Stops on a route | search_routes → get_route_stops |
| Next bus from a stop | get_next_departures |
| Is there space / available seats | get_seat_availability |
| Where is my bus | get_live_bus_location |
| Fare / how much will it cost | search_routes → get_fare_info |
| Best time to travel (less crowded) | search_routes → get_passenger_demand |
| Trip from A to B (multi-stop) | **disambiguate both A and B first** → plan_multi_stop_trip |
| Nearby stops / closest bus stop | get_nearby_stops |
| Cancel a booking | get_upcoming_bookings → list → confirm → cancel_booking |
| Rate my last trip | get_completed_trips → ask stars + comment → confirm → submit_rating |
| Wallet top-up history / explain charge | get_wallet_transactions |
| Where to reload wallet | get_top_up_locations |
| Report issue (delay/driver/safety) | Gather category + description from user → confirm → file_complaint |
| Lost item on bus | get_trip_history → confirm trip → file_complaint category="lost" |
| Book a private taxi | **search_stops(pickup) + search_stops(destination)** → disambiguate both → confirm → initiate_taxi_booking |

## Multi-step chaining examples
- "How long does Route 5 take?" → search_routes("5") → get_route_stops(route_id)
- "Is the 3pm bus to Jounieh full?" → search_stops("Jounieh") → disambiguate → get_seat_availability
- "Best time to take the Hamra bus" → search_routes("Hamra") → get_passenger_demand(route_id)
- "Cancel my booking tomorrow" → get_upcoming_bookings() → present list → cancel after confirmation
- "I want to go to the airport" → search_stops("airport") + search_routes("airport") → list matches → ask which one → search_routes for routes to confirmed stop → initiate_taxi_booking or plan_multi_stop_trip

## Behaviour rules
1. **Always call a tool first** before answering factual questions. Never say "I don't have access to real-time data."
2. **Chain tools automatically** — never ask the user for a route_id, stop_id, or ticket_id; derive it from tool results.
3. **Disambiguate first** (Rule 0 above) — never assume a place name is unique.
4. **Confirm before side-effects**: cancellations, ratings, complaints — show exactly what you'll submit and wait for "yes".
5. **Be concise**: 2-4 sentences for simple answers. No filler phrases like "Sure, let me check that for you!".
6. **Format**: **bold** for amounts, route names, times. "•" for bullet lists. Number options when asking the user to choose.
7. **No results**: say clearly "I didn't find any X matching that" and suggest rephrasing or a related search.
8. **Location-aware**: for "near me" queries call get_nearby_stops first; if no GPS, ask for their area then use search_routes.
9. **Taxi booking**: always disambiguate both pickup and destination via search_stops before calling initiate_taxi_booking.`;
}

// ── Main route handler ────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  const user     = req.user;
  const message  = String(req.body.message ?? "").trim();
  const history  = Array.isArray(req.body.history) ? req.body.history : [];
  const rawLoc   = req.body.location;
  const location = rawLoc?.latitude && rawLoc?.longitude
    ? { latitude: parseFloat(rawLoc.latitude), longitude: parseFloat(rawLoc.longitude) }
    : null;

  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const pool = await poolPromise;

    const actionRef = { current: null };
    const ctx = { userId: user.user_id, pool, actionRef, location };

    const recentHistory = history.slice(-10).map(m => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: String(m.content ?? ""),
    }));

    const messages = [
      { role: "system", content: buildSystemPrompt(user, location) },
      ...recentHistory,
      { role: "user", content: message },
    ];

    let reply = "";
    let iterations = 0;

    while (iterations < 5) {
      iterations++;

      const response = await openai.chat.completions.create({
        model:       DEPLOYMENT,
        messages,
        tools:       TOOLS,
        tool_choice: "auto",
        max_tokens:  600,
        temperature: 0.4,
      });

      const choice = response.choices[0];
      const msg    = choice.message;

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        reply = msg.content ?? "";
        break;
      }

      messages.push(msg);

      const toolResults = await Promise.all(
        msg.tool_calls.map(async (tc) => {
          let args = {};
          try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { /* ignore */ }
          const result = await executeTool(tc.function.name, args, ctx);
          return {
            role:         "tool",
            tool_call_id: tc.id,
            content:      JSON.stringify(result),
          };
        })
      );

      messages.push(...toolResults);
    }

    res.json({
      reply:  reply || "I'm having trouble right now. Please try again shortly.",
      action: actionRef.current,
    });

  } catch (err) {
    console.error("[chatbot]", err.message);
    const isAzureErr = err.status >= 400 && err.status < 600;
    res.status(isAzureErr ? 502 : 500).json({
      error: "Chatbot unavailable",
      reply: "I'm having a moment — please try again in a few seconds.",
    });
  }
};
