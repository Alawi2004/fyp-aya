import express from "express";
import {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  verifyTicket,
} from "../controllers/bookings.controller.js";

const router = express.Router();

router.get("/", getBookings);
router.post("/", createBooking);
router.post("/verify", verifyTicket);
router.get("/:id", getBookingById);
router.delete("/:id", cancelBooking);

export default router;
