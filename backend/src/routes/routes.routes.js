import express from "express";
import {
  getRoutes,
  getRouteById,
  updateRoute,
  createRoute,
  getRouteStops,
  assignStopToRoute,
} from "../controllers/routes.controller.js";
import { getMultiTripRoute } from "../controllers/multiTrip.controller.js";

const router = express.Router();

// GET /api/routes
router.get("/", getRoutes);

// GET /api/routes/multi-trip?start_id=&end_id=&mode=fastest
router.get("/multi-trip", getMultiTripRoute);

// POST /api/routes
router.post("/", createRoute);

// GET /api/routes/:id
router.get("/:id", getRouteById);

// PUT /api/routes/:id
router.put("/:id", updateRoute);

// POST /api/routes/:route_id/stops
router.post("/:route_id/stops", assignStopToRoute);

// GET /api/routes/:route_id/stops
router.get("/:route_id/stops", getRouteStops);

export default router;
