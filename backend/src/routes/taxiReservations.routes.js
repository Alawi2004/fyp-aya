import express from "express";
import { createTaxiReservation, getMyTaxiReservations } from "../controllers/taxiReservations.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/",   requireAuth, createTaxiReservation);
router.get("/",    requireAuth, getMyTaxiReservations);

export default router;
