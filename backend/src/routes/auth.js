import { Router } from 'express';
import { sign } from '../middleware/auth.js';
import { requestOtp, verifyOtp } from '../../../db/src/auth_repo.js';
import { createUser } from '../../../db/src/repo.js';

const router = Router();

const isProd = () => (process.env.NODE_ENV || 'development') === 'production';

// Request an OTP. In production the code is never returned in the response.
router.post('/otp', async (req, res, next) => {
  try {
    const { phone } = req.body || {};
    const result = await requestOtp({ phone, exposeCode: !isProd() });
    res.json({ ok: true, phone: result.phone, ...(result.code ? { dev_otp: result.code } : {}) });
  } catch (err) { next(err); }
});

// Verify the OTP and issue a session token.
router.post('/verify', async (req, res, next) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) return res.status(400).json({ error: 'phone_and_code_required' });
    const verdict = await verifyOtp({ phone, code });
    if (!verdict.ok) return res.status(401).json({ error: verdict.error });
    const user = await createUser({ phone, role: 'creator' });
    const token = sign({ sub: phone, uid: user.id, role: user.role });
    res.json({ ok: true, token, user: { id: user.id, phone: user.phone, role: user.role } });
  } catch (err) { next(err); }
});

export default router;
