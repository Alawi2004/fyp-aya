import express from "express";
import {
  getTripsDashboard,
  getDashboardStats,
  getDashboardOverview,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/trips", getTripsDashboard);
router.get("/stats", getDashboardStats);
router.get("/overview", getDashboardOverview);

export default router;
