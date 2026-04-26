import express from "express";
import {
  searchUser,
  staffTopUpWallet,
  getStaffHistory,
  getStaffStats,
} from "../controllers/staffWallet.controller.js";
import { requireStaffOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes are staff-only — requireStaffOnly blocks admin and all other roles.

router.get("/search",  requireStaffOnly, searchUser);
router.post("/topup",  requireStaffOnly, staffTopUpWallet);
router.get("/history", requireStaffOnly, getStaffHistory);
router.get("/stats",   requireStaffOnly, getStaffStats);

export default router;
