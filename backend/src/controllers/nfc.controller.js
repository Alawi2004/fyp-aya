/**
 * NFC Card Controller — Yalla Transit
 *
 * Manages the passenger ↔ NFC-card linking lifecycle.
 * A linked NFC card can be tapped at the bus reader instead of presenting a QR code.
 * The driver-side scan endpoint lives in driverApp.controller.js (scanNfc).
 */

import { poolPromise, sql } from "../db/db.js";

// ── GET /api/nfc/status ───────────────────────────────────────────────────────
// Returns the authenticated passenger's currently linked NFC card, or { linked: false }.
export const getNfcStatus = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.user.user_id)
      .query(`
        SELECT TOP 1 nfc_id, card_uid, status, linked_at
        FROM   nfc_cards
        WHERE  user_id = @uid AND status = 'active'
        ORDER  BY linked_at DESC
      `);

    if (!result.recordset[0]) return res.json({ linked: false });

    const card = result.recordset[0];
    res.json({
      linked:    true,
      nfc_id:    card.nfc_id,
      uid:       card.card_uid,
      status:    card.status,
      linked_at: card.linked_at,
    });
  } catch (err) {
    console.error("[nfc] status error:", err);
    res.status(500).json({ error: "Failed to fetch NFC status" });
  }
};

// ── POST /api/nfc/link ────────────────────────────────────────────────────────
// Links a scanned NFC tag UID to the authenticated passenger's account.
// Body: { uid: "AB:CD:EF:01" }
export const linkCard = async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid || typeof uid !== "string" || !uid.trim()) {
      return res.status(400).json({ error: "uid is required" });
    }

    const userId   = req.user.user_id;
    const cleanUid = uid.trim().toUpperCase();
    const pool     = await poolPromise;

    // Reject if this UID is actively linked to a DIFFERENT account
    const existing = await pool.request()
      .input("card_uid", sql.NVarChar(64), cleanUid)
      .query(`
        SELECT TOP 1 user_id
        FROM   nfc_cards
        WHERE  card_uid = @card_uid AND status = 'active'
      `);

    if (existing.recordset[0] && existing.recordset[0].user_id !== userId) {
      return res.status(409).json({ error: "This NFC card is already linked to another account." });
    }

    // Deactivate any previously linked card for this user
    await pool.request()
      .input("uid", sql.Int, userId)
      .query(`
        UPDATE nfc_cards
        SET    status = 'inactive', unlinked_at = GETUTCDATE()
        WHERE  user_id = @uid AND status = 'active'
      `);

    // Insert new link
    const ins = await pool.request()
      .input("user_id",  sql.Int,          userId)
      .input("card_uid", sql.NVarChar(64), cleanUid)
      .query(`
        INSERT INTO nfc_cards (user_id, card_uid, status)
        OUTPUT INSERTED.nfc_id, INSERTED.card_uid, INSERTED.linked_at
        VALUES (@user_id, @card_uid, 'active')
      `);

    const card = ins.recordset[0];
    res.status(201).json({
      nfc_id:    card.nfc_id,
      uid:       card.card_uid,
      status:    "active",
      linked_at: card.linked_at,
      message:   "NFC card linked successfully",
    });
  } catch (err) {
    console.error("[nfc] link error:", err);
    res.status(500).json({ error: "Failed to link NFC card" });
  }
};

// ── DELETE /api/nfc/unlink ────────────────────────────────────────────────────
// Deactivates the authenticated passenger's linked NFC card.
export const unlinkCard = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.user.user_id)
      .query(`
        UPDATE nfc_cards
        SET    status = 'inactive', unlinked_at = GETUTCDATE()
        WHERE  user_id = @uid AND status = 'active'
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "No active NFC card linked to this account." });
    }
    res.json({ message: "NFC card unlinked" });
  } catch (err) {
    console.error("[nfc] unlink error:", err);
    res.status(500).json({ error: "Failed to unlink NFC card" });
  }
};
