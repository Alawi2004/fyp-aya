import express from "express";
import {
  getRatings,
  createRating,
  getTripRatings,
} from "../controllers/ratings.controller.js";

const router = express.Router();

router.get("/", getRatings);
router.post("/", createRating);
router.get("/trip/:trip_id", getTripRatings);
router.get("/:trip_id", getTripRatings);

export default router;
