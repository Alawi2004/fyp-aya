import express from "express";
import { createStopRequest, getMyStopRequests } from "../controllers/stopRequests.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", requireAuth, createStopRequest);
router.get("/",  requireAuth, getMyStopRequests);

export default router;
