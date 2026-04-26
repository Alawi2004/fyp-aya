import express from "express";
import {
  getDriverTrips,
  startTrip,
  completeTrip,
  getTripPassengers,
  getDriverEarnings,
  reportIssue,
  sendEmergency,
  updateLocation,
} from "../controllers/driverApp.controller.js";

const router = express.Router();

router.get("/trips", getDriverTrips);
router.put("/trips/:id/start", startTrip);
router.put("/trips/:id/complete", completeTrip);
router.get("/trips/:id/passengers", getTripPassengers);
router.get("/earnings", getDriverEarnings);
router.post("/issues", reportIssue);
router.post("/emergency", sendEmergency);
router.post("/location", updateLocation);

export default router;
