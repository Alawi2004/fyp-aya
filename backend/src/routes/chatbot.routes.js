import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { sendMessage } from "../controllers/chatbot.controller.js";

const router = express.Router();

// POST /api/chatbot/message — authenticated passengers only
router.post("/message", requireAuth, sendMessage);

export default router;
