import express from "express";
import { getStops, createStop } from "../controllers/stops.controller.js";

const router = express.Router();

router.get("/", getStops);
router.post("/", createStop);

export default router;
