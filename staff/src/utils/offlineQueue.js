// Offline top-up queue with HMAC-SHA256 signing via SubtleCrypto (no deps)
const QUEUE_KEY  = "staff_offline_queue";
const SIGN_SECRET = "yalla-staff-v1-2026";

async function hmacSign(payload) {
  try {
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey(
      "raw", enc.encode(SIGN_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"],
    );
    const raw  = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `nosig-${Date.now()}`;
  }
}

export const offlineQueue = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
    catch { return []; }
  },

  _save(items) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  },

  async enqueue(payload) {
    const sigInput = JSON.stringify({ ...payload, _ts: Date.now() });
    const signature = await hmacSign(sigInput);
    const item = {
      id:         `OFQ-${Date.now()}`,
      created_at: new Date().toISOString(),
      payload,
      signature,
      status:     "pending",
    };
    const items = this.getAll();
    items.push(item);
    this._save(items);
    return item;
  },

  getPending() {
    return this.getAll().filter(i => i.status === "pending");
  },

  markSynced(id, receipt) {
    this._save(this.getAll().map(i =>
      i.id === id ? { ...i, status: "synced", synced_at: new Date().toISOString(), receipt } : i
    ));
  },

  markFailed(id, error) {
    this._save(this.getAll().map(i =>
      i.id === id ? { ...i, status: "failed", error } : i
    ));
  },
};
