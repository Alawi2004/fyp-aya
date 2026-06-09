import express from "express";
import { createTaxiReservation, getMyTaxiReservations, expandMapUrl } from "../controllers/taxiReservations.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/expand-map", expandMapUrl);              // no auth — public URL proxy
router.post("/",   requireAuth, createTaxiReservation);
router.get("/",    requireAuth, getMyTaxiReservations);

export default router;
