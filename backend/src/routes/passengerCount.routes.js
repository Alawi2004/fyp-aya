import express from "express";
import {
  recordPassengerCount,
  getPassengerCountsByTrip,
} from "../controllers/passengerCount.controller.js";

const router = express.Router();

router.post("/", recordPassengerCount);
router.get("/:trip_id", getPassengerCountsByTrip);

export default router;
