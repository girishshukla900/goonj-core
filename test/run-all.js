// Runs every test suite in one command. Used by CI and `npm test`.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const suites = [
  ['db',        'db/test/db.test.js'],
  ['auth',      'backend/test/auth.test.js'],
  ['backend',   'backend/test/smoke.js'],
  ['export',    'backend/test/export.test.js'],
  ['dubbing',   'dubbing/test/pipeline.test.js'],
  ['payments',  'payments/test/payments.test.js'],
  ['live',      'live/test/live.test.js'],
  ['community', 'community/test/community.test.js'],
  ['system',    'test/system.test.js'],
  ['web',       'web/test/client.test.js'],
];

// Every suite seeds the same demo data, so they each need a clean database.
// PGlite (the default) is in-memory per process, so it is already isolated.
// A real Postgres server is shared, so when GOONJ_FRESH_DB=1 we give each suite
// its own database. That is what the `test-postgres` CI job uses.
const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || '');
const freshDb = process.env.GOONJ_FRESH_DB === '1' && isPostgres;

async function freshDatabaseUrls() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const urls = [];
  for (let i = 0; i < suites.length; i++) {
    const name = `goonj_test_${i + 1}`;
    await pool.query(`DROP DATABASE IF EXISTS ${name}`);
    await pool.query(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/' + name;
    urls.push(url.toString());
  }
  await pool.end();
  return urls;
}

const urls = freshDb ? await freshDatabaseUrls() : [];

let failed = 0;
for (let i = 0; i < suites.length; i++) {
  const [name, file] = suites[i];
  process.stdout.write(`\n=== ${name} ===\n`);
  const env = freshDb ? { ...process.env, DATABASE_URL: urls[i] } : process.env;
  const r = spawnSync(process.execPath, [path.join(ROOT, file)], { cwd: ROOT, stdio: 'inherit', env });
  if (r.status !== 0) { failed++; console.error(`!! ${name} FAILED`); }
}
console.log(`\n${failed === 0 ? 'ALL SUITES PASSED' : failed + ' SUITE(S) FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
