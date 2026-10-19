// Goonj web client — talks to the real API. No build step, no dependencies.
const params = new URLSearchParams(location.search);
const API = params.get('api') || localStorage.getItem('goonj_api') || 'http://localhost:4000';
localStorage.setItem('goonj_api', API);

const LANGS = [
  { code: 'hi', name: 'हिन्दी' }, { code: 'ta', name: 'தமிழ்' }, { code: 'bn', name: 'বাংলা' },
  { code: 'te', name: 'తెలుగు' }, { code: 'mr', name: 'मराठी' }, { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'kn', name: 'ಕನ್ನಡ' }, { code: 'bho', name: 'भोजपुरी' },
];
const TABS = [['home', 'For You'], ['live', 'Live'], ['studio', 'Studio'], ['clubs', 'Clubs']];

const CH = 'meera';   // the signed-in creator's channel
const state = { token: localStorage.getItem('goonj_token') || null, screen: 'home', lang: 'hi', video: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (state.token) headers.authorization = 'Bearer ' + state.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let parsed = null;
  try { parsed = await res.json(); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}

/* ---------- auth ---------- */
async function signIn() {
  const phone = '9999999999';
  const otp = await api('/v1/auth/otp', { method: 'POST', body: { phone } });
  const verified = await api('/v1/auth/verify', { method: 'POST', body: { phone, code: otp.body.dev_otp } });
  if (verified.body && verified.body.token) {
    state.token = verified.body.token;
    localStorage.setItem('goonj_token', state.token);
    $('#loginBtn').textContent = 'Signed in';
    toast('Signed in');
    render();
  } else {
    toast('Sign in failed');
  }
}

/* ---------- screens ---------- */
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([id, label]) =>
    `<button data-tab="${id}" class="${state.screen === id ? 'on' : ''}">${label}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { state.screen = b.dataset.tab; render(); }));
}

async function screenHome() {
  const { body } = await api(`/v1/feed?lang=${state.lang}`);
  const items = (body && body.items) || [];
  const cards = items.map((v) => `
    <article class="card" data-id="${v.id}" data-title="${esc(v.title)}" data-lang="${esc(v.source_lang)}" data-channel="${esc(v.channel_name)}">
      <div class="thumb" style="background:linear-gradient(150deg,#dd7a1a,#152742)">${esc((v.channel_name || '?')[0])}</div>
      <div class="body">
        <div class="title">${esc(v.title)}</div>
        <div class="meta">${esc(v.channel_name)} · ${esc(v.region || '')}</div>
        <span class="tag">${esc(v.source_lang)}</span>
      </div>
    </article>`).join('');
  $('#main').innerHTML = `
    <h1>Your district, your language</h1>
    <div class="sub">Regional-first discovery — ${items.length} video(s) for <b>${state.lang}</b></div>
    <div class="grid">${cards || '<div class="skel">No videos yet. Run <code>npm --prefix db run seed</code>.</div>'}</div>`;
  $('#main').querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => openWatch(c.dataset)));
}

async function screenStudio() {
  if (!state.token) { $('#main').innerHTML = `<h1>Creator Studio</h1><div class="sub">Sign in to see your studio.</div>`; return; }
  const { body } = await api('/v1/earnings?channel_id=ch_meera');
  const bal = (body && body.balance_paise) || 0;
  $('#main').innerHTML = `
    <h1>Creator Studio</h1>
    <div class="sub">Balance, split and payouts — live from the ledger.</div>
    <div class="grid">
      <div class="kpi hero"><div class="k">Available balance</div><div class="v" id="balance">₹${(bal / 100).toFixed(2)}</div>
        <div class="meta">90% creator share</div></div>
      <div class="kpi"><div class="k">Ledger entries</div><div class="v">${((body && body.ledger) || []).length}</div>
        <div class="meta">double-entry</div></div>
    </div>
    <div class="row"><button class="btn em" id="payout">Withdraw to UPI</button>
      <button class="btn" id="exportBtn">Export my data</button></div>
    <div class="note" id="payoutNote">UPI payouts are daily and automatic.</div>
    <div class="note" id="exportNote">Your content is yours — take it any time.</div>`;
  $('#payout').addEventListener('click', async () => {
    const r = await api('/v1/earnings/payouts', { method: 'POST', body: { channel_id: CH, upi_id: 'meera@okaxis' } });
    if (r.status === 202) { toast('Payout sent · ' + r.body.utr); $('#payoutNote').textContent = 'Paid ₹' + ((r.body.amount_paise || 0) / 100).toFixed(2) + ' · ' + r.body.utr; $('#balance').textContent = '₹' + ((r.body.balance_paise || 0) / 100).toFixed(2); }
    else toast('Payout failed: ' + ((r.body && r.body.error) || r.status));
  });
  $('#exportBtn').addEventListener('click', async () => {
    const r = await api('/v1/export/summary?channel_id=' + CH);
    if (r.status === 200) {
      $('#exportNote').textContent = `Exported ${r.body.videos} videos · ${r.body.ledger_entries} ledger entries · ₹${(r.body.balance_paise / 100).toFixed(2)} balance`;
      toast('Export ready');
    } else toast('Export failed');
  });
}

async function screenLive() {
  $('#main').innerHTML = `
    <h1>Live</h1>
    <div class="sub">One stream, many destinations — and an AI Clip Factory.</div>
    <div class="row"><button class="btn acc" id="goLive">Start a stream</button>
      <button class="btn" id="makeClips" disabled>Generate clips</button></div>
    <div class="note" id="liveNote">Not streaming.</div>
    <div class="row"><input id="chatInput" placeholder="Say something in chat…" disabled
        style="flex:1;padding:9px 12px;border-radius:999px;border:1px solid var(--border);background:var(--surface)">
      <button class="btn" id="sendChat" disabled>Send</button></div>
    <div class="note" id="chatList">Chat is empty.</div>
    <div class="grid" id="clips"></div>`;
  let streamId = null;
  let chatCount = 0;
  $('#goLive').addEventListener('click', async () => {
    if (!state.token) return toast('Sign in first');
    const r = await api('/v1/live/streams', { method: 'POST', body: { channel_id: CH, title: 'Rajma Chawal Live', source_lang: 'hi' } });
    if (r.status === 201) {
      streamId = r.body.id;
      $('#liveNote').textContent = 'Live on: ' + r.body.destinations.map((d) => d.label).join(', ');
      $('#makeClips').disabled = false;
      $('#chatInput').disabled = false;
      $('#sendChat').disabled = false;
      toast('Stream created');
    } else toast('Could not start stream');
  });
  $('#sendChat').addEventListener('click', async () => {
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    const r = await api(`/v1/live/streams/${streamId}/chat`, { method: 'POST', body: { user: 'me', text } });
    if (r.status === 201 || r.status === 202) {
      chatCount += 1;
      $('#chatList').textContent = chatCount === 1 ? `me: ${text}` : $('#chatList').textContent + `\nme: ${text}`;
      input.value = '';
    } else toast('Message failed');
  });

  $('#makeClips').addEventListener('click', async () => {
    const r = await api(`/v1/live/streams/${streamId}/clips`, { method: 'POST', body: { count: 3 } });
    const clips = (r.body && r.body.clips) || [];
    $('#clips').innerHTML = clips.map((c) => `
      <div class="card"><div class="body">
        <div class="title">${esc(c.title)}</div>
        <div class="meta">${c.start}s–${c.end}s · score ${c.score}</div>
        <span class="tag">${esc(c.hook)}</span></div></div>`).join('');
    toast(clips.length + ' clips generated');
  });
}

async function screenClubs() {
  $('#main').innerHTML = `
    <h1>Fan Clubs</h1>
    <div class="sub">Memberships, superfan badges and the fan leaderboard.</div>
    <div class="row">
      <button class="btn acc" data-tier="supporter">Join Supporter ₹49</button>
      <button class="btn acc" data-tier="silver">Join Silver ₹149</button>
      <button class="btn acc" data-tier="gold">Join Gold ₹499</button>
    </div>
    <div class="note" id="clubNote">Pick a tier to join.</div>
    <h1 style="font-size:15px;margin-top:16px">Leaderboard</h1>
    <div id="board" class="note">—</div>`;
  const loadBoard = async () => {
    const { body } = await api('/v1/community/channels/ch_meera/leaderboard');
    const rows = (body && body.leaderboard) || [];
    $('#board').innerHTML = rows.length
      ? rows.map((r) => `${r.rank}. ${esc(r.user_id)} — ${esc(r.tier)} (${esc(r.badge)})`).join('<br>')
      : 'No members yet.';
  };
  $('#main').querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', async () => {
    if (!state.token) return toast('Sign in first');
    const r = await api('/v1/community/memberships', { method: 'POST', body: { user_id: 'u_web', channel_id: CH, tier: b.dataset.tier } });
    if (r.status === 201) { $('#clubNote').textContent = `Joined ${r.body.tier} · badge: ${r.body.badge}`; toast('Joined ' + r.body.tier); loadBoard(); }
    else toast('Could not join');
  }));
  loadBoard();
}

/* ---------- watch overlay ---------- */
function openWatch(d) {
  state.video = d;
  $('#player').textContent = (d.channel || '?')[0];
  $('#wTitle').textContent = d.title;
  $('#wMeta').textContent = `${d.channel} · ${d.lang}`;
  $('#wActions').innerHTML = `
    <button class="btn primary" data-act="sub">Subscribe</button>
    <button class="btn" data-act="like">Like</button>
    <button class="btn em" data-act="tip">Tip ₹50</button>`;
  $('#dubChips').innerHTML = LANGS.map((l) => `<button class="chip" data-code="${l.code}">${l.name}</button>`).join('');
  $('#dubNote').textContent = `Original audio: ${d.lang}. Pick a language to dub this video in the creator's own voice.`;
  $('#watch').classList.add('on');
  $('#wActions').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => toast(b.dataset.act === 'tip' ? 'Tip sent ₹50 via UPI' : 'Done')));
  $('#dubChips').querySelectorAll('.chip').forEach((c) => c.addEventListener('click', async () => {
    if (!state.token) return toast('Sign in first');
    const r = await api(`/v1/videos/${d.id}/dubs`, { method: 'POST', body: { channel_id: CH, source_lang: d.lang, target_langs: [c.dataset.code] } });
    $('#dubChips').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
    $('#dubNote').textContent = (r.status === 202)
      ? `Queued: ${c.textContent} — dubbing in the creator's own voice.`
      : 'Could not queue the dub.';
    toast(r.status === 202 ? 'Dub queued' : 'Dub failed');
  }));
}
$('#closeWatch').addEventListener('click', () => $('#watch').classList.remove('on'));
$('#loginBtn').addEventListener('click', signIn);

/* ---------- boot ---------- */
function render() {
  renderTabs();
  const map = { home: screenHome, live: screenLive, studio: screenStudio, clubs: screenClubs };
  (map[state.screen] || screenHome)();
}
$('#loginBtn').textContent = state.token ? 'Signed in' : 'Sign in';
render();
