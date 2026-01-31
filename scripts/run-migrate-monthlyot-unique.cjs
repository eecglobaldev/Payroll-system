/**
 * Add unique index on monthlyot (employeecode, month) if missing.
 * Usage: node scripts/run-migrate-monthlyot-unique.cjs (from backend dir)
 */

const path = require('path');
const fs = require('fs');

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const envPaths = [path.join(backendDir, '.env'), path.join(rootDir, '.env')];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('[migrate] Loaded .env from', envPath);
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
    console.error('[migrate] DB_HOST not set.');
    process.exit(1);
  }

  const sqlPath = path.join(backendDir, 'migrations', 'add_monthlyot_unique_employeecode_month.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8').replace(/^--.*$/gm, '').trim();

  const pool = new Pool(poolConfig);
  try {
    await pool.query(sql);
    console.log('[migrate] monthlyot unique index migration applied.');
  } catch (err) {
    console.error('[migrate] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
