// One connection handle, two backends:
//   - DATABASE_URL = postgres://...  -> a real Postgres server (node-postgres)
//   - anything else (or unset)       -> PGlite (Postgres compiled to WASM)
// Both expose { kind, query(text, params) -> { rows }, exec(sql), close() }.
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

let handle = null;

export async function getDb() {
  if (handle) return handle;
  const url = process.env.DATABASE_URL || '';
  if (/^postgres(ql)?:\/\//.test(url)) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    handle = {
      kind: 'pg', _pool: pool,
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    const pglite = new PGlite(url && url !== 'memory://' ? url : undefined);
    handle = {
      kind: 'pglite', _pglite: pglite,
      query: (text, params) => pglite.query(text, params),
      exec: (sql) => pglite.exec(sql),
      close: () => pglite.close(),
    };
  }
  return handle;
}

/**
 * Run `fn(q)` inside a single transaction, where `q(text, params)` is bound to
 * one connection. Rolls back and rethrows on error. Works on both backends.
 */
export async function withTransaction(fn) {
  const db = await getDb();
  if (db.kind === 'pg') {
    const client = await db._pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((text, params) => client.query(text, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return db._pglite.transaction(async (tx) => fn((text, params) => tx.query(text, params)));
}

export async function closeDb() {
  if (handle) { await handle.close(); handle = null; }
}
