import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

// Balance + ledger for a channel. Proxies to the payments service when configured.
router.get('/', requireAuth, async (req, res) => {
  const channelId = req.query.channel_id;
  if (!config.paymentsUrl || !channelId) {
    return res.json({
      channel_id: channelId || null, balance_paise: 0, currency: 'INR', ledger: [],
      note: config.paymentsUrl ? 'pass ?channel_id=' : 'PAYMENTS_URL not set',
    });
  }
  try {
    const [balance, ledger] = await Promise.all([
      fetch(`${config.paymentsUrl}/balance/${channelId}`).then((r) => r.json()),
      fetch(`${config.paymentsUrl}/ledger/${channelId}`).then((r) => r.json()),
    ]);
    res.json({ ...balance, currency: 'INR', ledger: ledger.entries || [] });
  } catch (err) {
    res.status(502).json({ error: 'payments_service_unreachable', detail: err.message });
  }
});

// Request a UPI payout.
router.post('/payouts', requireAuth, async (req, res) => {
  const { channel_id, amount_paise, upi_id } = req.body || {};
  if (!upi_id) return res.status(400).json({ error: 'upi_id_required' });
  if (!config.paymentsUrl) {
    return res.status(202).json({
      channel_id, amount_paise: amount_paise || 0, upi_id, status: 'queued',
      note: 'PAYMENTS_URL not set; payout not wired.',
    });
  }
  try {
    const upstream = await fetch(`${config.paymentsUrl}/payouts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel_id, amount_paise, upi_id }),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: 'payments_service_unreachable', detail: err.message });
  }
});

export default router;
