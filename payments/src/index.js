// Goonj payments service — HTTP API. The ledger is backed by PostgreSQL.
import http from 'node:http';
import { toRupees } from './money.js';
import { recordEarning, creatorBalance, journalBalances, journalTotal, entriesFor, accounts } from './ledger.js';
import { requestPayout, dailyRun, payoutsFor, registerUpi } from './payouts.js';

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) reject(new Error('payload_too_large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function view(channelId) {
  const balance = await creatorBalance(channelId);
  return { channel_id: channelId, balance_paise: balance, balance_rupees: toRupees(balance) };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && p === '/health') {
        return json(res, 200, { ok: true, service: 'goonj-payments', balanced: await journalBalances() });
      }

      if (req.method === 'POST' && p === '/earnings') {
        const b = await readJson(req);
        if (!b.channel_id || !b.gross_paise) return json(res, 400, { error: 'channel_id and gross_paise required' });
        const tx = await recordEarning({
          channel_id: b.channel_id, video_id: b.video_id, source: b.source || 'ad',
          gross_paise: b.gross_paise, ref: b.ref,
        });
        return json(res, 201, {
          txn_id: tx.txn_id, gross_paise: b.gross_paise,
          creator_paise: tx.creator_paise, platform_paise: tx.platform_paise,
          ...(await view(b.channel_id)),
        });
      }

      const balMatch = p.match(/^\/balance\/([^/]+)$/);
      if (req.method === 'GET' && balMatch) return json(res, 200, await view(balMatch[1]));

      const ledMatch = p.match(/^\/ledger\/([^/]+)$/);
      if (req.method === 'GET' && ledMatch) {
        return json(res, 200, { channel_id: ledMatch[1], entries: await entriesFor(ledMatch[1]) });
      }

      if (req.method === 'POST' && p === '/channels/upi') {
        const b = await readJson(req);
        return json(res, 200, await registerUpi({ channel_id: b.channel_id, upi_id: b.upi_id }));
      }

      if (req.method === 'POST' && p === '/payouts') {
        const b = await readJson(req);
        const amount = b.amount_paise || (await creatorBalance(b.channel_id));
        const payout = await requestPayout({ channel_id: b.channel_id, upi_id: b.upi_id, amount_paise: amount });
        return json(res, 202, { ...payout, ...(await view(b.channel_id)) });
      }

      if (req.method === 'POST' && p === '/payouts/run') {
        const b = await readJson(req);
        return json(res, 200, await dailyRun({ min_paise: b.min_paise ?? 100 }));
      }

      const poMatch = p.match(/^\/payouts\/([^/]+)$/);
      if (req.method === 'GET' && poMatch) {
        return json(res, 200, { channel_id: poMatch[1], payouts: await payoutsFor(poMatch[1]) });
      }

      if (req.method === 'GET' && p === '/journal') {
        return json(res, 200, {
          balanced: await journalBalances(), total: await journalTotal(), accounts: await accounts(),
        });
      }

      return json(res, 404, { error: 'not_found' });
    } catch (err) {
      return json(res, err.status || 500, { error: err.message || 'internal_error' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PAYMENTS_PORT || 4200);
  createServer().listen(port, () => console.log(`Goonj payments service on :${port}`));
}
