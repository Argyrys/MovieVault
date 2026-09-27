import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const dbDisabled = !env.databaseUrl;

export const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

function disabledError() {
  const err = new Error('Database not configured (DB-less mode)');
  err.code = 'DB_DISABLED';
  return err;
}

export async function query(text, params) {
  if (dbDisabled) throw disabledError();
  return pool.query(text, params);
}

export async function one(text, params) {
  if (dbDisabled) throw disabledError();
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

export async function many(text, params) {
  if (dbDisabled) throw disabledError();
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
