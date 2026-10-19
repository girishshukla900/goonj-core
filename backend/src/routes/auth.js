import { Router } from 'express';
import { sign } from '../middleware/auth.js';

const router = Router();

// Phase 0: in-memory OTP store. Replace with Redis + an SMS provider before launch.
const otps = new Map();

router.post('/otp', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone_required' });
  const code = '0000'; // dev OTP only
  otps.set(phone, { code, exp: Date.now() + 5 * 60 * 1000 });
  res.json({ ok: true, phone, dev_otp: code });
});

router.post('/verify', (req, res) => {
  const { phone, code } = req.body || {};
  const record = otps.get(phone);
  if (!record || record.code !== code || record.exp < Date.now()) {
    return res.status(401).json({ error: 'invalid_otp' });
  }
  otps.delete(phone);
  const token = sign({ sub: phone, role: 'creator' });
  res.json({ ok: true, token });
});

export default router;
