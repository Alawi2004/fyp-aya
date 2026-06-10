import express from "express";
import { getAuditLogs } from "../controllers/auditLog.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", requireAdminOnly, getAuditLogs);

export default router;
