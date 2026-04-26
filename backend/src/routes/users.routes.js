import express from "express";
import {
  getAllUsers,
  getUserProfile,
  updateUserProfile,
  getUserTickets,
  getUserNotifications,
} from "../controllers/users.controller.js";

const router = express.Router();

router.get("/", getAllUsers);
router.get("/:id", getUserProfile);
router.put("/:id", updateUserProfile);
router.get("/:id/tickets", getUserTickets);
router.get("/:id/notifications", getUserNotifications);

export default router;
