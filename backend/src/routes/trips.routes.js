import express from "express";
import {
  createTrip,
  getTrips,
  getTripById,
  updateTripStatus,
  getTripsByVehicleType,
  getPassengerLoad,
} from "../controllers/trips.controller.js";

const router = express.Router();

router.post("/", createTrip);
router.get("/", getTrips);
router.get("/vehicle/:type", getTripsByVehicleType);
router.get("/vehicle-type/:type", getTripsByVehicleType);
router.get("/:id/load", getPassengerLoad);
router.get("/:id/passenger-load", getPassengerLoad);
router.get("/:id", getTripById);
router.put("/:id/status", updateTripStatus);
router.put("/:id", updateTripStatus);

export default router;
