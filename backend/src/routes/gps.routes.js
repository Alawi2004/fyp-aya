import express from "express";
import {
  sendGpsLocation,
  getLatestGps,
} from "../controllers/gps.controller.js";

const router = express.Router();

// Driver sends GPS location
router.post("/", sendGpsLocation);

// Get latest GPS point for trip
router.get("/:trip_id/latest", getLatestGps);

export default router;
