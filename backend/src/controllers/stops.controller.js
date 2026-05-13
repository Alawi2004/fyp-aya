import { poolPromise, sql } from "../db/db.js";
import { ensureRouteTables } from "../db/featureSetup.js";
import qrcode from "qrcode";

export const getStops = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM stops WHERE is_deleted = 0");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stops" });
  }
};

export const deleteStop = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE stops SET is_deleted = 1 WHERE stop_id = @id AND is_deleted = 0");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Stop not found" });
    res.json({ message: "Stop soft-deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete stop" });
  }
};

export const createStop = async (req, res) => {
  try {
    const { stop_name, latitude, longitude } = req.body;
    const pool = await poolPromise;

    await pool.request()
      .input("stop_name", sql.VarChar,       stop_name)
      .input("latitude",  sql.Decimal(9, 6), latitude)
      .input("longitude", sql.Decimal(9, 6), longitude)
      .query("INSERT INTO stops(stop_name,latitude,longitude) VALUES(@stop_name,@latitude,@longitude)");

    res.json({ message: "Stop created successfully" });
  } catch (err) {
    console.error("Create stop error:", err);
    res.status(500).json({ error: "Failed to create stop" });
  }
};

// ── Stop amenities ────────────────────────────────────────────────────────────

const AMENITY_DEFAULTS = {
  has_shelter: false, has_seating: false, has_lighting: false,
  has_wheelchair: false, has_ticket_machine: false, has_wifi: false,
  nearby_landmark: null, nfc_tag_id: null,
};

export const getStopAmenities = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureRouteTables(pool);

    const result = await pool.request()
      .input("stop_id", sql.Int, req.params.id)
      .query(`
        SELECT stop_id, has_shelter, has_seating, has_lighting,
               has_wheelchair, has_ticket_machine, has_wifi,
               nearby_landmark, nfc_tag_id, updated_at
        FROM stop_amenities WHERE stop_id=@stop_id
      `);

    const row = result.recordset[0];
    if (!row) return res.json({ stop_id: Number(req.params.id), ...AMENITY_DEFAULTS });

    res.json({
      ...row,
      has_shelter:        row.has_shelter        === true,
      has_seating:        row.has_seating        === true,
      has_lighting:       row.has_lighting       === true,
      has_wheelchair:     row.has_wheelchair     === true,
      has_ticket_machine: row.has_ticket_machine === true,
      has_wifi:           row.has_wifi           === true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch amenities" });
  }
};

export const updateStopAmenities = async (req, res) => {
  try {
    const stopId = req.params.id;
    const {
      has_shelter, has_seating, has_lighting,
      has_wheelchair, has_ticket_machine, has_wifi,
      nearby_landmark, nfc_tag_id,
    } = req.body;

    const pool = await poolPromise;
    await ensureRouteTables(pool);

    await pool.request()
      .input("stop_id",           sql.Int,          stopId)
      .input("has_shelter",       sql.Bit,           has_shelter        ? 1 : 0)
      .input("has_seating",       sql.Bit,           has_seating        ? 1 : 0)
      .input("has_lighting",      sql.Bit,           has_lighting       ? 1 : 0)
      .input("has_wheelchair",    sql.Bit,           has_wheelchair     ? 1 : 0)
      .input("has_ticket_machine",sql.Bit,           has_ticket_machine ? 1 : 0)
      .input("has_wifi",          sql.Bit,           has_wifi           ? 1 : 0)
      .input("nearby_landmark",   sql.NVarChar(200), nearby_landmark || null)
      .input("nfc_tag_id",        sql.NVarChar(100), nfc_tag_id        || null)
      .query(`
        IF EXISTS (SELECT 1 FROM stop_amenities WHERE stop_id=@stop_id)
          UPDATE stop_amenities SET
            has_shelter=@has_shelter, has_seating=@has_seating, has_lighting=@has_lighting,
            has_wheelchair=@has_wheelchair, has_ticket_machine=@has_ticket_machine, has_wifi=@has_wifi,
            nearby_landmark=@nearby_landmark, nfc_tag_id=@nfc_tag_id, updated_at=GETUTCDATE()
          WHERE stop_id=@stop_id
        ELSE
          INSERT INTO stop_amenities
            (stop_id,has_shelter,has_seating,has_lighting,has_wheelchair,has_ticket_machine,has_wifi,nearby_landmark,nfc_tag_id)
          VALUES
            (@stop_id,@has_shelter,@has_seating,@has_lighting,@has_wheelchair,@has_ticket_machine,@has_wifi,@nearby_landmark,@nfc_tag_id)
      `);

    res.json({ message: "Amenities updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update amenities" });
  }
};

// ── Stop QR code ──────────────────────────────────────────────────────────────

export const getStopQR = async (req, res) => {
  try {
    const stopId = req.params.id;

    // Get stop name for the QR payload
    const pool = await poolPromise;
    const row = await pool.request()
      .input("id", sql.Int, stopId)
      .query("SELECT stop_name FROM stops WHERE stop_id=@id");

    const stopName = row.recordset[0]?.stop_name ?? `Stop ${stopId}`;
    const qrData   = `${process.env.ADMIN_BASE_URL || "https://yallatransit.app"}/stop/${stopId}`;

    const dataUrl = await qrcode.toDataURL(qrData, {
      width: 200, margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });

    res.json({ qr_code: dataUrl, data: qrData, stop_name: stopName, stop_id: stopId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
};
