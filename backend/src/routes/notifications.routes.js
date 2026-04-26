import express from "express";
import {
  getAllNotifications,
  markNotificationRead,
  createNotification,
  getUserNotifications,
} from "../controllers/notifications.controller.js";

const router = express.Router();

router.get("/", getAllNotifications);
router.post("/", createNotification);
router.put("/:id/read", markNotificationRead);
router.get("/user/:user_id", getUserNotifications);
router.get("/:user_id", getUserNotifications);

export default router;
