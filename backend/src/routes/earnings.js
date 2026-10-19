import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ balance: 0, currency: 'INR', ledger: [] });
});

// Request a UPI payout (Phase 2 wires the payments provider).
router.post('/payouts', requireAuth, (req, res) => {
  const { amount, upi_id } = req.body || {};
  if (!upi_id) return res.status(400).json({ error: 'upi_id_required' });
  res.status(202).json({ amount: amount || 0, upi_id, status: 'queued' });
});

export default router;
