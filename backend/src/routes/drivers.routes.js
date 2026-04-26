import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
} from "../controllers/drivers.controller.js";

const router = express.Router();

router.post("/", createDriver);
router.get("/", getDrivers);
router.get("/:id", getDriverById);
router.put("/:id", updateDriver);

export default router;
