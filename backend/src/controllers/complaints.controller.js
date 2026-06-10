import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { COMPLAINT_UPLOAD_BASE_URL } from "../middleware/complaintUpload.middleware.js";

// Keep in sync with the categories offered in the passenger app's complaint form.
const CATEGORY_LABELS = {
  delay:       "Service Delay",
  driver:      "Driver Behaviour",
  vehicle:     "Vehicle Issue",
  cleanliness: "Cleanliness",
  overcharge:  "Overcharging",
  safety:      "Safety Concern",
  lost:        "Lost Item",
  other:       "Other",
};
const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
const VALID_STATUSES = new Set(["submitted", "under_review", "assigned", "resolved", "closed"]);

// Passengers may only edit/delete their own complaint while it hasn't been
// picked up yet — once staff start working on it, the record must stay stable
// for the audit trail.
const EDITABLE_STATUSES = new Set(["submitted"]);

const normalizeValue = (value) => String(value || "").trim().toLowerCase();

const createTrackingCode = () => {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CMP-${stamp}-${random}`;
};

const insertUpdate = async (
  requestSource,
  { complaintId, actorUserId, actionType, oldStatus = null, newStatus = null, comment = null }
) => {
  await requestSource
    .request()
    .input("complaintId", sql.Int, complaintId)
    .input("actorUserId", sql.Int, actorUserId || null)
    .input("actionType", sql.NVarChar(30), actionType)
    .input("oldStatus", sql.NVarChar(20), oldStatus)
    .input("newStatus", sql.NVarChar(20), newStatus)
    .input("comment", sql.NVarChar(1000), comment)
    .query(`
      INSERT INTO complaint_updates
        (complaint_id, actor_user_id, action_type, old_status, new_status, comment)
      VALUES
        (@complaintId, @actorUserId, @actionType, @oldStatus, @newStatus, @comment)
    `);
};

const getComplaintWithTimeline = async (pool, complaintId) => {
  const complaintRes = await pool
    .request()
    .input("complaintId", sql.Int, complaintId)
    .query(`
      SELECT
        c.*,
        submitter.full_name AS submitted_by_name,
        assignee.full_name AS assigned_to_name,
        drUser.full_name AS driver_name,
        r.route_name
      FROM complaints c
      JOIN users submitter ON submitter.user_id = c.submitted_by_user_id
      LEFT JOIN users assignee ON assignee.user_id = c.assigned_to_user_id
      LEFT JOIN drivers d ON d.driver_id = c.driver_id
      LEFT JOIN users drUser ON drUser.user_id = d.user_id
      LEFT JOIN routes r ON r.route_id = c.route_id
      WHERE c.complaint_id = @complaintId
    `);

  const complaint = complaintRes.recordset[0];
  if (!complaint) {
    return null;
  }

  const updatesRes = await pool
    .request()
    .input("complaintId", sql.Int, complaintId)
    .query(`
      SELECT
        cu.*,
        u.full_name AS actor_name
      FROM complaint_updates cu
      LEFT JOIN users u ON u.user_id = cu.actor_user_id
      WHERE cu.complaint_id = @complaintId
      ORDER BY cu.created_at DESC
    `);

  complaint.timeline = updatesRes.recordset;
  return complaint;
};

const assertComplaintAccess = (req, complaint) => {
  if (!complaint) {
    return { allowed: false, status: 404, body: { error: "Complaint not found" } };
  }

  if (["admin", "staff"].includes(req.user.role)) {
    return { allowed: true };
  }

  if (complaint.submitted_by_user_id !== req.user.user_id) {
    return { allowed: false, status: 403, body: { error: "Forbidden" } };
  }

  return { allowed: true };
};

export const submitComplaint = async (req, res) => {
  const category = normalizeValue(req.body.category);
  const priority = normalizeValue(req.body.priority || "medium");
  const description = req.body.description?.trim();
  // The passenger app doesn't collect a separate subject line — derive one from the category.
  const title = req.body.title?.trim() || `${CATEGORY_LABELS[category] || "General"} Complaint`;

  if (!description || !category) {
    return res.status(400).json({ error: "description and category are required" });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid complaint category" });
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ error: "Invalid complaint priority" });
  }

  // Coerce optional FK fields safely — bad/non-numeric values become NULL
  // rather than tripping SQL Int validation and rejecting the whole insert.
  const toPositiveInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const tripId   = toPositiveInt(req.body.trip_id);
  const driverId = toPositiveInt(req.body.driver_id);
  const routeId  = toPositiveInt(req.body.route_id);
  const photoUrl = req.file ? `${COMPLAINT_UPLOAD_BASE_URL}/${req.file.filename}` : null;

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const trackingCode = createTrackingCode();
    const result = await pool
      .request()
      .input("trackingCode", sql.NVarChar(30), trackingCode)
      .input("submittedBy", sql.Int, req.user.user_id)
      .input("tripId", sql.Int, tripId)
      .input("driverId", sql.Int, driverId)
      .input("routeId", sql.Int, routeId)
      .input("title", sql.NVarChar(200), title)
      .input("description", sql.NVarChar(sql.MAX), description)
      .input("category", sql.NVarChar(50), category)
      .input("priority", sql.NVarChar(20), priority)
      .input("photoUrl", sql.NVarChar(500), photoUrl)
      .query(`
        INSERT INTO complaints
          (tracking_code, submitted_by_user_id, trip_id, driver_id, route_id, title, description, category, priority, photo_url)
        OUTPUT INSERTED.complaint_id, INSERTED.tracking_code, INSERTED.status, INSERTED.submitted_at, INSERTED.photo_url
        VALUES
          (@trackingCode, @submittedBy, @tripId, @driverId, @routeId, @title, @description, @category, @priority, @photoUrl)
      `);

    const complaint = result.recordset[0];
    await insertUpdate(pool, {
      complaintId: complaint.complaint_id,
      actorUserId: req.user.user_id,
      actionType: "submitted",
      newStatus: complaint.status,
      comment: "Complaint submitted",
    });

    res.status(201).json({
      message: "Complaint submitted successfully",
      complaint,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
};

export const listComplaints = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const request = pool.request();
    const conditions = [];

    if (["admin", "staff"].includes(req.user.role)) {
      if (req.query.status) {
        request.input("status", sql.NVarChar(20), normalizeValue(req.query.status));
        conditions.push("c.status = @status");
      }
      if (req.query.category) {
        request.input("category", sql.NVarChar(50), normalizeValue(req.query.category));
        conditions.push("c.category = @category");
      }
      if (req.query.priority) {
        request.input("priority", sql.NVarChar(20), normalizeValue(req.query.priority));
        conditions.push("c.priority = @priority");
      }
      if (req.query.assigned_to) {
        request.input("assignedTo", sql.Int, Number.parseInt(req.query.assigned_to, 10));
        conditions.push("c.assigned_to_user_id = @assignedTo");
      }
    } else {
      request.input("submittedBy", sql.Int, req.user.user_id);
      conditions.push("c.submitted_by_user_id = @submittedBy");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await request.query(`
      SELECT
        c.complaint_id,
        c.tracking_code,
        c.title,
        c.description,
        c.category,
        c.priority,
        c.status,
        c.photo_url,
        c.submitted_at,
        c.assigned_at,
        c.resolved_at,
        c.resolution_notes,
        submitter.full_name AS submitted_by_name,
        assignee.full_name AS assigned_to_name
      FROM complaints c
      JOIN users submitter ON submitter.user_id = c.submitted_by_user_id
      LEFT JOIN users assignee ON assignee.user_id = c.assigned_to_user_id
      ${whereClause}
      ORDER BY c.submitted_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
};

export const getComplaintById = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const complaint = await getComplaintWithTimeline(pool, req.params.id);
    const access = assertComplaintAccess(req, complaint);
    if (!access.allowed) {
      return res.status(access.status).json(access.body);
    }

    res.json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch complaint" });
  }
};

export const getComplaintTracking = getComplaintById;

export const assignComplaint = async (req, res) => {
  const assignedToUserId = Number.parseInt(req.body.assigned_to_user_id, 10);
  if (!Number.isInteger(assignedToUserId)) {
    return res.status(400).json({ error: "assigned_to_user_id is required" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const existing = await getComplaintWithTimeline(pool, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const result = await pool
      .request()
      .input("complaintId", sql.Int, req.params.id)
      .input("assignedTo", sql.Int, assignedToUserId)
      .query(`
        UPDATE complaints
        SET assigned_to_user_id = @assignedTo,
            assigned_at = GETUTCDATE(),
            status = CASE WHEN status IN ('resolved', 'closed') THEN status ELSE 'assigned' END,
            last_updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE complaint_id = @complaintId
      `);

    await insertUpdate(pool, {
      complaintId: Number.parseInt(req.params.id, 10),
      actorUserId: req.user.user_id,
      actionType: "assigned",
      oldStatus: existing.status,
      newStatus: result.recordset[0]?.status || existing.status,
      comment: req.body.comment?.trim() || `Assigned to user ${assignedToUserId}`,
    });

    res.json({
      message: "Complaint assigned successfully",
      complaint: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign complaint" });
  }
};

export const updateComplaintStatus = async (req, res) => {
  const nextStatus = normalizeValue(req.body.status);
  if (!VALID_STATUSES.has(nextStatus)) {
    return res.status(400).json({ error: "Invalid complaint status" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const existing = await getComplaintWithTimeline(pool, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const result = await pool
      .request()
      .input("complaintId", sql.Int, req.params.id)
      .input("status", sql.NVarChar(20), nextStatus)
      .input("notes", sql.NVarChar(1000), req.body.comment?.trim() || null)
      .query(`
        UPDATE complaints
        SET status = @status,
            resolved_at = CASE WHEN @status IN ('resolved', 'closed') THEN ISNULL(resolved_at, GETUTCDATE()) ELSE NULL END,
            resolution_notes = CASE WHEN @status IN ('resolved', 'closed') THEN @notes ELSE resolution_notes END,
            last_updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE complaint_id = @complaintId
      `);

    await insertUpdate(pool, {
      complaintId: Number.parseInt(req.params.id, 10),
      actorUserId: req.user.user_id,
      actionType: "status_changed",
      oldStatus: existing.status,
      newStatus: nextStatus,
      comment: req.body.comment?.trim() || null,
    });

    res.json({
      message: "Complaint status updated successfully",
      complaint: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update complaint status" });
  }
};

export const resolveComplaint = async (req, res) => {
  req.body.status = normalizeValue(req.body.status || "resolved");
  req.body.comment = req.body.resolution_notes || req.body.comment;
  return updateComplaintStatus(req, res);
};

// PUT /api/complaints/:id — owner can edit their own complaint while it's
// still unhandled (status === 'submitted')
export const editMyComplaint = async (req, res) => {
  const category = req.body.category != null ? normalizeValue(req.body.category) : null;
  const priority = req.body.priority != null ? normalizeValue(req.body.priority) : null;
  const description = req.body.description != null ? req.body.description.trim() : null;

  if (category && !VALID_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid complaint category" });
  }
  if (priority && !VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ error: "Invalid complaint priority" });
  }
  if (description !== null && description.length < 20) {
    return res.status(400).json({ error: "Description must be at least 20 characters" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const existing = await pool.request()
      .input("id",  sql.Int, Number(req.params.id))
      .input("uid", sql.Int, req.user.user_id)
      .query(`SELECT complaint_id, status, category FROM complaints WHERE complaint_id = @id AND submitted_by_user_id = @uid`);

    const current = existing.recordset[0];
    if (!current) {
      return res.status(404).json({ error: "Complaint not found or not yours" });
    }
    if (!EDITABLE_STATUSES.has(current.status)) {
      return res.status(403).json({ error: "This complaint is already being processed and can no longer be edited." });
    }

    const nextCategory = category || current.category;
    const result = await pool.request()
      .input("id",          sql.Int,            Number(req.params.id))
      .input("uid",         sql.Int,            req.user.user_id)
      .input("category",    sql.NVarChar(50),   nextCategory)
      .input("priority",    sql.NVarChar(20),   priority)
      .input("description", sql.NVarChar(sql.MAX), description)
      .input("title",       sql.NVarChar(200),  CATEGORY_LABELS[nextCategory] ? `${CATEGORY_LABELS[nextCategory]} Complaint` : null)
      .query(`
        UPDATE complaints
        SET    category    = @category,
               title       = ISNULL(@title, title),
               priority    = COALESCE(@priority, priority),
               description = COALESCE(@description, description),
               last_updated_at = GETUTCDATE()
        OUTPUT INSERTED.complaint_id, INSERTED.tracking_code, INSERTED.title, INSERTED.description,
               INSERTED.category, INSERTED.priority, INSERTED.status, INSERTED.photo_url,
               INSERTED.submitted_at
        WHERE  complaint_id = @id AND submitted_by_user_id = @uid
      `);

    await insertUpdate(pool, {
      complaintId: Number(req.params.id),
      actorUserId: req.user.user_id,
      actionType: "edited",
      oldStatus: current.status,
      newStatus: current.status,
      comment: "Complaint edited by passenger",
    });

    res.json({ message: "Complaint updated", complaint: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update complaint" });
  }
};

// DELETE /api/complaints/:id — owner can delete their own complaint while it's
// still unhandled (status === 'submitted')
export const deleteMyComplaint = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const existing = await pool.request()
      .input("id",  sql.Int, Number(req.params.id))
      .input("uid", sql.Int, req.user.user_id)
      .query(`SELECT status FROM complaints WHERE complaint_id = @id AND submitted_by_user_id = @uid`);

    const current = existing.recordset[0];
    if (!current) {
      return res.status(404).json({ error: "Complaint not found or not yours" });
    }
    if (!EDITABLE_STATUSES.has(current.status)) {
      return res.status(403).json({ error: "This complaint is already being processed and can no longer be deleted." });
    }

    await pool.request()
      .input("id",  sql.Int, Number(req.params.id))
      .input("uid", sql.Int, req.user.user_id)
      .query(`DELETE FROM complaints WHERE complaint_id = @id AND submitted_by_user_id = @uid`);

    res.json({ message: "Complaint deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete complaint" });
  }
};
