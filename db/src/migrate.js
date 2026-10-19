// Apply schema.sql. Idempotent; memoised so it runs once per process.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './connect.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = fs.readFileSync(path.resolve(HERE, '..', 'schema.sql'), 'utf8');
  const db = await getDb();
  await db.exec(sql);
  return db.kind;
}

let ready = null;
export function ensureSchema() {
  if (!ready) ready = migrate();
  return ready;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then((kind) => console.log(`migrated (${kind})`));
}
