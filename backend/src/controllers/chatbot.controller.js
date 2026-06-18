import OpenAI from "openai";
import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

// ── Azure AI Foundry client ───────────────────────────────────────────────────
// Endpoint format: https://{resource}.services.ai.azure.com/api/projects/{project}
// SDK appends /chat/completions; api-version goes as a query param.
const openai = new OpenAI({
  apiKey:       process.env.AZURE_OPENAI_KEY,
  baseURL:      process.env.AZURE_OPENAI_ENDPOINT,
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview" },
});
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1-mini";

// ── Tool definitions (sent to the model so it knows what to call) ─────────────
const TOOLS = [
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
      description: "Files a complaint on behalf of the passenger. Call only after confirming the details with the user.",
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
        },
        required: ["title", "description", "category"],
      },
    },
  },
];

// ── Tool executor — runs the chosen tool against the DB ───────────────────────
async function executeTool(name, args, userId, pool) {
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
        .input("uid",   sql.Int, userId)
        .input("top",   sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            tk.ticket_id,
            tk.status       AS ticket_status,
            tk.amount,
            tk.booking_time,
            r.route_name,
            r.start_location,
            r.end_location,
            tr.start_time,
            tr.status       AS trip_status
          FROM tickets tk
          JOIN trips   tr ON tr.trip_id  = tk.trip_id
          JOIN routes  r  ON r.route_id  = tr.route_id
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
            tk.ticket_id,
            tk.status,
            tk.seat_number,
            tk.amount,
            tk.booking_time,
            r.route_name,
            r.start_location,
            r.end_location,
            tr.start_time,
            tr.status AS trip_status
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

    // ── Next departures from a stop ─────────────────────────────────────────
    case "get_next_departures": {
      const limit  = Math.min(5, Math.max(1, parseInt(args.limit ?? 3, 10)));
      const sq     = `%${(args.stop_name ?? "").trim()}%`;
      const r = await pool.request()
        .input("sq",  sql.NVarChar(200), sq)
        .input("top", sql.Int, limit)
        .query(`
          SELECT TOP (@top)
            tr.trip_id,
            tr.start_time,
            tr.status,
            r.route_name,
            r.start_location,
            r.end_location
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

    // ── Live GPS for the user's active trip ──────────────────────────────────
    case "get_live_bus_location": {
      // Find the most recent active trip the user has a ticket for
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

    // ── File complaint ───────────────────────────────────────────────────────
    case "file_complaint": {
      await ensureOperationalTables(pool);
      const stamp   = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand    = Math.random().toString(36).slice(2, 8).toUpperCase();
      const code    = `CMP-${stamp}-${rand}`;
      const priority = args.priority ?? "medium";

      await pool.request()
        .input("code",   sql.NVarChar(30),   code)
        .input("uid",    sql.Int,            userId)
        .input("title",  sql.NVarChar(200),  String(args.title).slice(0, 200))
        .input("desc",   sql.NVarChar(sql.MAX), String(args.description))
        .input("cat",    sql.NVarChar(50),   args.category)
        .input("pri",    sql.NVarChar(20),   priority)
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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(user) {
  return `You are the Yalla Transit AI assistant, embedded in the passenger mobile app.
Be concise, friendly, and helpful. Always use the available tools to get real data before answering factual questions about routes, balances, or tickets — never guess.

User context:
- Name: ${user.full_name ?? user.email}
- Role: passenger
- User ID: ${user.user_id}

Guidelines:
- For route/stop/schedule questions: call search_routes or get_next_departures first
- For balance questions: call get_wallet_balance
- For ticket questions: call get_active_ticket
- For "where is my bus": call get_live_bus_location
- For complaints: confirm category and description with the user before calling file_complaint
- Keep replies short (3-5 sentences max unless listing stops or trips)
- Format lists with bullet points using "•" character
- Use **bold** for key values like amounts, route names, times`;
}

// ── Main route handler ────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  const user    = req.user;
  const message = String(req.body.message ?? "").trim();
  const history = Array.isArray(req.body.history) ? req.body.history : [];

  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const pool = await poolPromise;

    // Build messages array: system + trimmed history (last 10 turns) + new user message
    const recentHistory = history.slice(-10).map(m => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: String(m.content ?? ""),
    }));

    const messages = [
      { role: "system", content: buildSystemPrompt(user) },
      ...recentHistory,
      { role: "user", content: message },
    ];

    // ── Agentic loop: call model → execute tools → call model again ──────────
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

      const choice  = response.choices[0];
      const msg     = choice.message;

      // No tool calls — model has a final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        reply = msg.content ?? "";
        break;
      }

      // Push the assistant's tool-calling message into history
      messages.push(msg);

      // Execute each tool call in parallel
      const toolResults = await Promise.all(
        msg.tool_calls.map(async (tc) => {
          let args = {};
          try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { /* ignore bad JSON */ }

          const result = await executeTool(tc.function.name, args, user.user_id, pool);
          return {
            role:         "tool",
            tool_call_id: tc.id,
            content:      JSON.stringify(result),
          };
        })
      );

      // Push tool results and loop for the model to synthesize
      messages.push(...toolResults);
    }

    res.json({ reply: reply || "I'm having trouble right now. Please try again shortly." });

  } catch (err) {
    console.error("[chatbot]", err.message);
    const isAzureErr = err.status >= 400 && err.status < 600;
    res.status(isAzureErr ? 502 : 500).json({
      error: "Chatbot unavailable",
      reply: "I'm having a moment — please try again in a few seconds.",
    });
  }
};
