// Goonj community service — HTTP API. Memberships etc. live in Postgres.
import http from 'node:http';
import * as repo from '../../db/src/community_repo.js';
import { tiersFor, setTiers } from './tiers.js';
import { join, cancel, membersFor, leaderboard } from './memberships.js';
import { createParty, rsvp, createPost, postsFor } from './parties.js';

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

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, service: 'goonj-community' });

      const mTiers = p.match(/^\/channels\/([^/]+)\/tiers$/);
      if (mTiers && req.method === 'GET') return json(res, 200, { channel_id: mTiers[1], tiers: await tiersFor(mTiers[1]) });
      if (mTiers && req.method === 'POST') {
        const b = await readJson(req);
        return json(res, 200, { channel_id: mTiers[1], tiers: await setTiers(mTiers[1], b.tiers || []) });
      }

      if (req.method === 'POST' && p === '/memberships') {
        const b = await readJson(req);
        if (!b.user_id || !b.channel_id || !b.tier) return json(res, 400, { error: 'user_id, channel_id, tier required' });
        return json(res, 201, await join(b));
      }
      if (req.method === 'POST' && p === '/memberships/cancel') {
        const b = await readJson(req);
        return json(res, 200, await cancel(b));
      }

      const mUserMemberships = p.match(/^\/users\/([^/]+)\/memberships$/);
      if (req.method === 'GET' && mUserMemberships) {
        return json(res, 200, { user_id: mUserMemberships[1], memberships: await repo.listMembershipsForUser(mUserMemberships[1]) });
      }

      const mMembers = p.match(/^\/channels\/([^/]+)\/members$/);
      if (req.method === 'GET' && mMembers) return json(res, 200, { channel_id: mMembers[1], members: await membersFor(mMembers[1]) });

      const mLeader = p.match(/^\/channels\/([^/]+)\/leaderboard$/);
      if (req.method === 'GET' && mLeader) return json(res, 200, { channel_id: mLeader[1], leaderboard: await leaderboard(mLeader[1]) });

      const mPosts = p.match(/^\/channels\/([^/]+)\/posts$/);
      if (mPosts && req.method === 'GET') {
        return json(res, 200, { channel_id: mPosts[1], posts: await postsFor(mPosts[1], { viewer_id: url.searchParams.get('viewer_id') }) });
      }
      if (req.method === 'POST' && p === '/posts') {
        const b = await readJson(req);
        if (!b.channel_id) return json(res, 400, { error: 'channel_id required' });
        return json(res, 201, await createPost(b));
      }

      if (req.method === 'POST' && p === '/parties') {
        const b = await readJson(req);
        if (!b.channel_id) return json(res, 400, { error: 'channel_id required' });
        return json(res, 201, await createParty(b));
      }
      const mParty = p.match(/^\/parties\/([^/]+)$/);
      if (req.method === 'GET' && mParty) {
        const party = await repo.getParty(mParty[1]);
        return party ? json(res, 200, party) : json(res, 404, { error: 'party_not_found' });
      }
      const mRsvp = p.match(/^\/parties\/([^/]+)\/rsvp$/);
      if (req.method === 'POST' && mRsvp) {
        const b = await readJson(req);
        return json(res, 200, await rsvp(mRsvp[1], b.user_id));
      }

      return json(res, 404, { error: 'not_found' });
    } catch (err) {
      return json(res, err.status || 500, { error: err.message || 'internal_error' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.COMMUNITY_PORT || 4400);
  createServer().listen(port, () => console.log(`Goonj community service on :${port}`));
}
