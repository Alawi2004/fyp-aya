// Staff Portal API Client
// Separate from admin — uses 'staff_token' localStorage key to avoid conflicts.
// In dev, Vite proxies /api/* → localhost:4000 so no CORS issue.
// In production set VITE_API_URL to your deployed backend URL.

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const FRONTEND_ONLY = import.meta.env.VITE_FRONTEND_ONLY !== "false";
const TOKEN_KEY = "staff_token";

let MOCK_USERS = [
  { user_id: 1001, full_name: "Aline Haddad", email: "aline.haddad@example.com", phone: "+961 70 111 222", balance: 35.5, status: "Active", joined: "2026-03-08" },
  { user_id: 1002, full_name: "Rania Saad", email: "rania.saad@example.com", phone: "+961 71 333 444", balance: 12.25, status: "Active", joined: "2026-03-14" },
  { user_id: 1003, full_name: "Omar Khalil", email: "omar.khalil@example.com", phone: "+961 76 555 666", balance: 0, status: "Inactive", joined: "2026-03-20" },
  { user_id: 1004, full_name: "Maya Nassar", email: "maya.nassar@example.com", phone: "+961 81 228 910", balance: 84.75, status: "Active", joined: "2026-03-22" },
  { user_id: 1005, full_name: "Karim Mansour", email: "karim.mansour@example.com", phone: "+961 03 451 882", balance: 6, status: "Active", joined: "2026-03-29" },
  { user_id: 1006, full_name: "Layal Tannous", email: "layal.tannous@example.com", phone: "+961 78 902 118", balance: 128.4, status: "Active", joined: "2026-04-01" },
  { user_id: 1007, full_name: "Hassan Daher", email: "hassan.daher@example.com", phone: "+961 79 771 304", balance: 3.5, status: "Blocked", joined: "2026-04-03" },
  { user_id: 1008, full_name: "Nour El Khoury", email: "nour.kh@example.com", phone: "+961 70 448 221", balance: 44, status: "Active", joined: "2026-04-07" },
  { user_id: 1009, full_name: "Tarek Fadel", email: "tarek.fadel@example.com", phone: "+961 71 920 557", balance: 19.9, status: "Active", joined: "2026-04-11" },
  { user_id: 1010, full_name: "Sara Abou Jaoude", email: "sara.aj@example.com", phone: "+961 03 611 744", balance: 61.2, status: "Suspended", joined: "2026-04-13" },
];

let MOCK_HISTORY = [
  { top_up_id: 5001, user_id: 1001, user_name: "Aline Haddad", user_email: "aline.haddad@example.com", user_phone: "+961 70 111 222", amount: 20, balance_before: 15.5, balance_after: 35.5, payment_method: "Cash", recharge_location: "Central Bus Station", transaction_reference: "STF-20260417-001", status: "completed", notes: "Morning counter top-up", created_at: new Date().toISOString() },
  { top_up_id: 5002, user_id: 1004, user_name: "Maya Nassar", user_email: "maya.nassar@example.com", user_phone: "+961 81 228 910", amount: 50, balance_before: 34.75, balance_after: 84.75, payment_method: "Card (Debit/Credit)", recharge_location: "Hamra Kiosk", transaction_reference: "STF-20260417-002", status: "completed", notes: "", created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5003, user_id: 1006, user_name: "Layal Tannous", user_email: "layal.tannous@example.com", user_phone: "+961 78 902 118", amount: 100, balance_before: 28.4, balance_after: 128.4, payment_method: "Bank Transfer", recharge_location: "Tripoli Terminal", transaction_reference: "STF-20260416-003", status: "completed", notes: "Receipt verified", created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5004, user_id: 1002, user_name: "Rania Saad", user_email: "rania.saad@example.com", user_phone: "+961 71 333 444", amount: 10, balance_before: 2.25, balance_after: 12.25, payment_method: "Mobile Transfer", recharge_location: "Hamra Kiosk", transaction_reference: "STF-20260416-004", status: "completed", notes: "", created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5005, user_id: 1008, user_name: "Nour El Khoury", user_email: "nour.kh@example.com", user_phone: "+961 70 448 221", amount: 25, balance_before: 19, balance_after: 44, payment_method: "Cash", recharge_location: "Airport Transit Hub", transaction_reference: "STF-20260415-005", status: "completed", notes: "", created_at: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5006, user_id: 1009, user_name: "Tarek Fadel", user_email: "tarek.fadel@example.com", user_phone: "+961 71 920 557", amount: 15, balance_before: 4.9, balance_after: 19.9, payment_method: "Voucher", recharge_location: "Saida Station", transaction_reference: "STF-20260414-006", status: "completed", notes: "Promo voucher", created_at: new Date(Date.now() - 78 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5007, user_id: 1005, user_name: "Karim Mansour", user_email: "karim.mansour@example.com", user_phone: "+961 03 451 882", amount: 6, balance_before: 0, balance_after: 6, payment_method: "Cash", recharge_location: "Central Bus Station", transaction_reference: "STF-20260413-007", status: "completed", notes: "", created_at: new Date(Date.now() - 104 * 60 * 60 * 1000).toISOString() },
  { top_up_id: 5008, user_id: 1001, user_name: "Aline Haddad", user_email: "aline.haddad@example.com", user_phone: "+961 70 111 222", amount: 15.5, balance_before: 0, balance_after: 15.5, payment_method: "Cash", recharge_location: "Jounieh Booth", transaction_reference: "STF-20260410-008", status: "completed", notes: "New wallet activation", created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
];

const getDateOnly = (dateLike) => new Date(dateLike).toISOString().slice(0, 10);

const mockStaffResponse = (method, path, body = {}) => {
  if (path.startsWith("/staff/wallet/search")) {
    const query = new URLSearchParams(path.split("?")[1] || "").get("q")?.toLowerCase() || "";
    return MOCK_USERS.filter((user) =>
      [user.full_name, user.email, user.phone, String(user.user_id)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  if (path.startsWith("/staff/wallet/history")) {
    const params = new URLSearchParams(path.split("?")[1] || "");
    const from = params.get("from");
    const to = params.get("to");
    const userId = params.get("user_id");
    const location = params.get("location")?.toLowerCase();

    return MOCK_HISTORY.filter((row) => {
      const rowDate = getDateOnly(row.created_at);
      if (from && rowDate < from) return false;
      if (to && rowDate > to) return false;
      if (userId && String(row.user_id) !== String(userId)) return false;
      if (location && !row.recharge_location.toLowerCase().includes(location)) return false;
      return true;
    });
  }

  if (path === "/staff/wallet/stats") {
    const today = getDateOnly(new Date());
    const todayRows = MOCK_HISTORY.filter((row) => getDateOnly(row.created_at) === today);
    return {
      total_count: MOCK_HISTORY.length,
      total_amount: MOCK_HISTORY.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      today_count: todayRows.length,
      today_amount: todayRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }

  if (path === "/staff/wallet/topup" && method === "POST") {
    const user = MOCK_USERS.find((item) => item.user_id === body.user_id) || MOCK_USERS[0];
    const amount = Number(body.amount || 0);
    const balanceBefore = Number(user.balance || 0);
    const balanceAfter = balanceBefore + amount;
    const topUp = {
      top_up_id: Date.now(),
      user_id: user.user_id,
      user_name: user.full_name,
      user_email: user.email,
      user_phone: user.phone,
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      payment_method: body.payment_method || "Cash",
      recharge_location: body.recharge_location || "Demo Counter",
      transaction_reference: body.transaction_reference || `DEMO-${Date.now()}`,
      status: "completed",
      notes: body.notes || "",
      created_at: new Date().toISOString(),
    };

    user.balance = balanceAfter;
    MOCK_HISTORY = [topUp, ...MOCK_HISTORY];

    return {
      top_up_id: topUp.top_up_id,
      user_name: user.full_name,
      amount_credited: amount,
      balance_before: balanceBefore,
      new_balance: balanceAfter,
      transaction_reference: topUp.transaction_reference,
      processed_at: topUp.created_at,
    };
  }

  return method === "GET" ? [] : { ok: true };
};

class StaffApiClient {
  constructor(base) {
    this.base = base;
  }

  getToken()        { return localStorage.getItem(TOKEN_KEY) || ""; }
  setToken(t)       { localStorage.setItem(TOKEN_KEY, t); }
  clearToken()      { localStorage.removeItem(TOKEN_KEY); }

  headers() {
    return {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${this.getToken()}`,
    };
  }

  async handle(res) {
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const body = await res.json(); msg = body.error || body.message || msg; } catch {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  async _fetch(method, path, body) {
    if (FRONTEND_ONLY) {
      return mockStaffResponse(method, path, body);
    }

    try {
      const opts = { method, headers: this.headers() };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(`${this.base}${path}`, opts);
      return this.handle(res);
    } catch (err) {
      // TypeError: Failed to fetch → backend unreachable
      if (err.name === "TypeError") {
        throw new Error("Cannot reach the server. Make sure the backend is running on port 4000.");
      }
      throw err;
    }
  }

  get(path)        { return this._fetch("GET",    path); }
  post(path, body) { return this._fetch("POST",   path, body); }
  put(path, body)  { return this._fetch("PUT",    path, body); }
  del(path)        { return this._fetch("DELETE", path); }
}

export default new StaffApiClient(API_BASE);
