import express from "express";
import {
  getWallet,
  getTransactions,
  getTopUpLocations,
  adminTopUpWallet,
  getRechargeAuditLog,
} from "../controllers/wallet.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Passenger — read-only
router.get("/",             requireAuth,  getWallet);
router.get("/transactions", requireAuth,  getTransactions);

// Public — no auth needed
router.get("/locations",                  getTopUpLocations);

// Admin / Staff only
router.post("/topup",       requireAdmin, adminTopUpWallet);
router.get("/recharges",    requireAdmin, getRechargeAuditLog);

export default router;
