import express from 'express';
import { issueToken, getSharedTicket, verifyShareQr } from '../controllers/shareTicket.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { crudLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// Generate a share token for a booking the authenticated user owns
router.post('/ticket/token', requireAuth, crudLimiter, issueToken);

// Public: validate + return safe ticket metadata from a share token
router.get('/ticket', crudLimiter, getSharedTicket);

// Driver/inspector: verify a share QR scan (returns validity + booking ID)
router.post('/ticket/verify', requireAuth, verifyShareQr);

export default router;
