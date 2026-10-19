// Tests the persistence layer against real Postgres (PGlite in-process).
import { seedDemo } from '../src/seed.js';
import {
  createUser, createChannel, insertVideo, publishVideo,
  feed, recordEarning, creatorBalance, insertPayout, ledgerCheck,
} from '../src/repo.js';
import { closeDb } from '../src/connect.js';

const checks = [];
const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

async function main() {
  try {
    const seeded = await seedDemo();
    const [ch1, ch2] = seeded.channels;

    // 1. Regional-first feed: the viewer's language comes first.
    const hiFeed = await feed({ lang: 'hi' });
    assert('feed returns published videos', hiFeed.length === 2);
    assert('Hindi viewer sees the Hindi video first', hiFeed[0].source_lang === 'hi');

    const taFeed = await feed({ lang: 'ta' });
    assert('Tamil viewer sees the Tamil video first', taFeed[0].source_lang === 'ta');

    // 2. Feed joins channel data.
    assert('feed rows carry channel name and region', hiFeed[0].channel_name === 'Meera Cooks' && hiFeed[0].region === 'Delhi');

    // 3. Money: 90/10 split persisted, integer paise.
    const earning = await recordEarning({ channel_id: ch1, source: 'ad', gross_paise: 100000 });
    assert('earning persisted with creator share 90000', Number(earning.creator_paise) === 90000);
    assert('earning persisted with platform share 10000', Number(earning.platform_paise) === 10000);

    // 4. Balance reflects earnings minus payouts.
    assert('creator balance is 90000 paise', (await creatorBalance(ch1)) === 90000);
    await insertPayout({ channel_id: ch1, amount_paise: 90000, upi_id: 'meera@okaxis', utr: 'UTR123456789012' });
    assert('balance is 0 after a full payout', (await creatorBalance(ch1)) === 0);

    // 5. Money integrity: gross == creator + platform across the whole ledger.
    const check = await ledgerCheck();
    assert('ledger is internally consistent (gross == parts)', check.ok === true);

    // 6. Types come back as numbers, not strings.
    assert('balance is a number', typeof (await creatorBalance(ch2)) === 'number');

    // 7. Duplicate phone is handled (upsert), not a crash.
    const again = await createUser({ phone: '9000000001', role: 'creator' });
    assert('duplicate user phone upserts cleanly', !!again.id);

    console.log('DB TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  backend:', (await (await import('../src/connect.js')).getDb()).kind);
    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error('DB TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    await closeDb().catch(() => {});
    process.exit(1);
  }
}

main();
