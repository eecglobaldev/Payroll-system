/**
 * Fix monthlyleaveusage sequence so next INSERT gets a valid id.
 * Use when duplicate key on monthlyleaveusage_pkey occurs (sequence out of sync).
 * Usage: node scripts/fix-monthlyleaveusage-sequence.cjs (from backend dir)
 */

const path = require('path');
const fs = require('fs');

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const envPaths = [path.join(backendDir, '.env'), path.join(rootDir, '.env')];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('[fix-seq] Loaded .env from', envPath);
    break;
  }
}

async function run() {
  const { Pool } = require('pg');

  const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'defaultdb',
    user: process.env.DB_USER || 'doadmin',
    password: process.env.DB_PASS || '',
    ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
      ? { rejectUnauthorized: false }
      : false,
  };

  if (!process.env.DB_HOST || process.env.DB_HOST === 'your-db-host') {
    console.error('[fix-seq] DB_HOST not set.');
    process.exit(1);
  }

  const pool = new Pool(poolConfig);

  try {
    const maxResult = await pool.query(
      'SELECT COALESCE(MAX(monthlyleaveusageid), 0) AS max_id FROM monthlyleaveusage'
    );
    const maxId = parseInt(maxResult.rows[0].max_id, 10);
    console.log('Max monthlyleaveusageid in table:', maxId);

    const seqResult = await pool.query(
      "SELECT last_value FROM monthlyleaveusage_monthlyleaveusageid_seq"
    );
    const lastVal = parseInt(seqResult.rows[0].last_value, 10);
    console.log('Sequence last_value:', lastVal);

    if (lastVal <= maxId) {
      const nextVal = maxId + 1;
      await pool.query(
        "SELECT setval('monthlyleaveusage_monthlyleaveusageid_seq', $1)",
        [maxId]
      );
      console.log('Set sequence to', maxId, '(next nextval() will be', nextVal + ')');
    } else {
      console.log('Sequence is ahead of max id; no change needed.');
    }
  } catch (err) {
    console.error('[fix-seq] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
