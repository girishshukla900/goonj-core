// One connection handle, two backends:
//   - DATABASE_URL = postgres://...  -> a real Postgres server (node-postgres)
//   - anything else (or unset)       -> PGlite (Postgres compiled to WASM)
// Both expose { query(text, params) -> { rows }, exec(sql), close() }.
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

let handle = null;

export async function getDb() {
  if (handle) return handle;
  const url = process.env.DATABASE_URL || '';
  if (/^postgres(ql)?:\/\//.test(url)) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    handle = {
      kind: 'pg',
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    const pglite = new PGlite(url && url !== 'memory://' ? url : undefined);
    handle = {
      kind: 'pglite',
      query: (text, params) => pglite.query(text, params),
      exec: (sql) => pglite.exec(sql),
      close: () => pglite.close(),
    };
  }
  return handle;
}

export async function closeDb() {
  if (handle) { await handle.close(); handle = null; }
}
