import express from "express";
import { getSettings, updateSettings, getSetting } from "../controllers/systemSettings.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",     requireAdminOnly, getSettings);
router.put("/",     requireAdminOnly, updateSettings);
router.get("/:key", requireAdminOnly, getSetting);

export default router;
