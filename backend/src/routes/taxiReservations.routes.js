import express from "express";
import { createTaxiReservation, getMyTaxiReservations, expandMapUrl, cancelTaxiReservation } from "../controllers/taxiReservations.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/expand-map", expandMapUrl);              // no auth — public URL proxy
router.post("/",       requireAuth, createTaxiReservation);
router.get("/",        requireAuth, getMyTaxiReservations);
router.delete("/:id",  requireAuth, cancelTaxiReservation);

export default router;
