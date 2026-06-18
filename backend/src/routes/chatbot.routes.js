import express from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { sendMessage } from "../controllers/chatbot.controller.js";

const router = express.Router();

// POST /api/chatbot/message — authenticated passengers only
router.post("/message", authenticateToken, sendMessage);

export default router;
