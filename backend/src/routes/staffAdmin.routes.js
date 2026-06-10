import express from "express";
import {
  getStaffAccounts,
  updateStaffAccount,
  getAllStaffTransactions,
  getSuspiciousTransactions,
  getReconciliation,
  updateReconciliation,
} from "../controllers/staffAdmin.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Staff account management ──────────────────────────────────────────────────
router.get("/accounts",      requireAdminOnly, getStaffAccounts);
router.put("/accounts/:id",  requireAdminOnly, updateStaffAccount);

// ── Admin view of all staff wallet transactions ───────────────────────────────
// Mounted at /api/staff, so these become /api/staff/wallet/all-history etc.
// They are checked after /api/staff/wallet (staffWalletRoutes) passes through.
router.get("/wallet/all-history", requireAdminOnly, getAllStaffTransactions);
router.get("/wallet/suspicious",  requireAdminOnly, getSuspiciousTransactions);

// ── Reconciliation ────────────────────────────────────────────────────────────
router.get("/reconciliation",      requireAdminOnly, getReconciliation);
router.put("/reconciliation/:id",  requireAdminOnly, updateReconciliation);

export default router;
