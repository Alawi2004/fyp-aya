import express from "express";
import {
  assignComplaint,
  deleteMyComplaint,
  editMyComplaint,
  getComplaintById,
  getComplaintTracking,
  listComplaints,
  resolveComplaint,
  submitComplaint,
  updateComplaintStatus,
} from "../controllers/complaints.controller.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";
import { uploadComplaintPhoto } from "../middleware/complaintUpload.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Complaints
 *   description: Complaint submission, tracking, assignment, and resolution
 */

/**
 * @swagger
 * /api/complaints:
 *   post:
 *     tags: [Complaints]
 *     summary: Submit a complaint
 *     security:
 *       - bearerAuth: []
 *   get:
 *     tags: [Complaints]
 *     summary: List complaints or the caller's own complaints
 *     security:
 *       - bearerAuth: []
 */
router.post("/", requireAuth, uploadComplaintPhoto, submitComplaint);
router.get("/", requireAuth, listComplaints);

/**
 * @swagger
 * /api/complaints/{id}:
 *   put:
 *     tags: [Complaints]
 *     summary: Edit your own complaint (only while status is 'submitted')
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Complaints]
 *     summary: Delete your own complaint (only while status is 'submitted')
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id",    requireAuth, editMyComplaint);
router.delete("/:id", requireAuth, deleteMyComplaint);

/**
 * @swagger
 * /api/complaints/{id}:
 *   get:
 *     tags: [Complaints]
 *     summary: Get complaint details
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", requireAuth, getComplaintById);

/**
 * @swagger
 * /api/complaints/{id}/tracking:
 *   get:
 *     tags: [Complaints]
 *     summary: Track a complaint by ID
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id/tracking", requireAuth, getComplaintTracking);

/**
 * @swagger
 * /api/complaints/{id}/assign:
 *   patch:
 *     tags: [Complaints]
 *     summary: Assign a complaint to a staff/admin user
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/assign", requireAdmin, assignComplaint);

/**
 * @swagger
 * /api/complaints/{id}/status:
 *   patch:
 *     tags: [Complaints]
 *     summary: Update complaint status
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/status", requireAdmin, updateComplaintStatus);

/**
 * @swagger
 * /api/complaints/{id}/resolve:
 *   patch:
 *     tags: [Complaints]
 *     summary: Resolve or close a complaint
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:id/resolve", requireAdmin, resolveComplaint);

export default router;
