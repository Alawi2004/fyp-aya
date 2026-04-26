import express from "express";
import {
  getBuses,
  getBusById,
  getBusLocation,
  getBusRoute,
} from "../controllers/buses.controller.js";

const router = express.Router();

router.get("/", getBuses);
router.get("/:id", getBusById);
router.get("/:id/location", getBusLocation);
router.get("/:id/route", getBusRoute);

export default router;
