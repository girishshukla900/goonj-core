import pg from 'pg';
import { config } from './config.js';

let pool = null;

// Lazy pool: importing this module never opens a connection, so the API
// can boot (and pass health checks) without a database during Phase 0.
export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
