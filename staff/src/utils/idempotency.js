// 30-second duplicate prevention for top-up submissions.
// Key = userId:amountCents — collisions within the window return a duplicate warning.
const STORE_KEY  = "staff_idempotency";
const EXPIRY_MS  = 30_000;

function makeKey(userId, amount) {
  return `${userId}:${Math.round(parseFloat(amount) * 100)}`;
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}

function pruneExpired(store) {
  const now = Date.now();
  Object.keys(store).forEach(k => { if (now - store[k] > EXPIRY_MS) delete store[k]; });
}

export const idempotency = {
  // Returns { isDuplicate, secondsLeft? }
  check(userId, amount) {
    const store = loadStore();
    pruneExpired(store);
    const key = makeKey(userId, amount);
    if (store[key]) {
      const secondsLeft = Math.ceil((EXPIRY_MS - (Date.now() - store[key])) / 1000);
      return { isDuplicate: true, secondsLeft };
    }
    return { isDuplicate: false };
  },

  // Register a key (call after check passes)
  register(userId, amount) {
    const store = loadStore();
    pruneExpired(store);
    store[makeKey(userId, amount)] = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  },

  // Unique header value for backend idempotency (30-second window bucket)
  headerKey(userId, amount) {
    const bucket = Math.floor(Date.now() / EXPIRY_MS);
    return `${userId}-${Math.round(parseFloat(amount) * 100)}-${bucket}`;
  },
};
