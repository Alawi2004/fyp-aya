import express from "express";
import {
  getTickets,
  getTicketsByTrip,
  bookTicket,
} from "../controllers/tickets.controller.js";

const router = express.Router();

router.get("/", getTickets);
router.get("/trip/:id", getTicketsByTrip);
router.post("/book", bookTicket);
router.post("/", bookTicket);

export default router;
