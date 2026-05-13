import express from "express";
import { listSchedules, createSchedule, updateSchedule, deleteSchedule, sendNow } from "../controllers/scheduledReports.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",              requireAuth, listSchedules);
router.post("/",             requireAuth, createSchedule);
router.put("/:id",           requireAuth, updateSchedule);
router.delete("/:id",        requireAuth, deleteSchedule);
router.post("/:id/send-now", requireAuth, sendNow);

export default router;
