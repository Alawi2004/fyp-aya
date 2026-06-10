import express from "express";
import {
  getComplaintTrendsReport,
  getDriverPerformanceReport,
  getPassengerUsageReport,
  getRevenueReport,
  getVehicleUtilizationReport,
  getTopRoutesReport,
} from "../controllers/reports.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAdminOnly);

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Detailed date-range reports with JSON or CSV export
 */

router.get("/revenue", getRevenueReport);
router.get("/passenger-usage", getPassengerUsageReport);
router.get("/driver-performance", getDriverPerformanceReport);
router.get("/complaint-trends", getComplaintTrendsReport);
router.get("/vehicle-utilization", getVehicleUtilizationReport);
router.get("/top-routes", getTopRoutesReport);

export default router;
