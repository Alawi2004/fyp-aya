import express from "express";
import { getSettings, updateSettings, getSetting, getPublicSettings } from "../controllers/systemSettings.controller.js";
import { requireAuth, requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/public", getPublicSettings);   // no auth — safe app-level keys only
router.get("/",     requireAuth,      getSettings);
router.put("/",     requireAdminOnly, updateSettings);
router.get("/:key", requireAuth,      getSetting);

export default router;
