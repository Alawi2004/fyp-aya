import express from "express";
import {
  getStops, createStop, deleteStop,
  getStopAmenities, updateStopAmenities, getStopQR,
} from "../controllers/stops.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",       getStops);
router.post("/",      createStop);
router.delete("/:id", requireAdminOnly, deleteStop);

// ── Stop amenities & QR ───────────────────────────────────────────────────────
router.get("/:id/amenities", getStopAmenities);
router.put("/:id/amenities", updateStopAmenities);
router.get("/:id/qr",        getStopQR);

export default router;
