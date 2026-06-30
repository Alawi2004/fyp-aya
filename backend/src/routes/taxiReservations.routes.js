import express from "express";
import {
  createTaxiReservation, getMyTaxiReservations, expandMapUrl, cancelTaxiReservation,
  getAllTaxiReservations, getDriverTaxiReservations, updateTaxiReservationStatus,
  updateTaxiReservationLocation, getTaxiReservationLocation,
} from "../controllers/taxiReservations.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/expand-map", expandMapUrl);              // no auth — public URL proxy

// Admin / staff — every reservation
router.get("/all", requireAdmin, getAllTaxiReservations);

// Driver — assigned + claimable requests, and status updates
router.get("/driver",       requireAuth, getDriverTaxiReservations);
router.put("/:id/status",   requireAuth, updateTaxiReservationStatus);
router.put("/:id/location", requireAuth, updateTaxiReservationLocation);  // driver streams GPS
router.get("/:id/location", requireAuth, getTaxiReservationLocation);     // passenger polls GPS

// Passenger — own reservations
router.post("/",       requireAuth, createTaxiReservation);
router.get("/",        requireAuth, getMyTaxiReservations);
router.delete("/:id",  requireAuth, cancelTaxiReservation);

export default router;
