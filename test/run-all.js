// Runs every test suite in one command. Used by CI and `npm test`.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const suites = [
  ['db',        'db/test/db.test.js'],
  ['backend',   'backend/test/smoke.js'],
  ['dubbing',   'dubbing/test/pipeline.test.js'],
  ['payments',  'payments/test/payments.test.js'],
  ['live',      'live/test/live.test.js'],
  ['community', 'community/test/community.test.js'],
  ['system',    'test/system.test.js'],
  ['web',       'web/test/client.test.js'],
];

let failed = 0;
for (const [name, file] of suites) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const r = spawnSync(process.execPath, [path.join(ROOT, file)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.error(`!! ${name} FAILED`); }
}
console.log(`\n${failed === 0 ? 'ALL SUITES PASSED' : failed + ' SUITE(S) FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
