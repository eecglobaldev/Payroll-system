/**
 * Run holidays table migration using .env credentials
 * Usage: node scripts/run-migrate-holidays.cjs (from backend dir)
 * Or: node backend/scripts/run-migrate-holidays.cjs (from project root)
 */

const path = require('path');
const fs = require('fs');

// Load .env from backend or project root
const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const envPaths = [
  path.join(backendDir, '.env'),
  path.join(rootDir, '.env'),
];

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
    console.error('[migrate] DB_HOST not set. Ensure .env contains DB_HOST, DB_NAME, DB_USER, DB_PASS.');
    process.exit(1);
  }

  const sqlPath = path.join(backendDir, 'migrations', 'create_holidays_table.sql');
  let sql = fs.readFileSync(sqlPath, 'utf8');
  // Remove comment-only lines so we don't send them as statements
  sql = sql.replace(/^--.*$/gm, '').trim();

  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const pool = new Pool(poolConfig);

  try {
    console.log('[migrate] Connecting to PostgreSQL...');
    const client = await pool.connect();
    try {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const preview = statement.substring(0, 55).replace(/\s+/g, ' ');
        console.log('[migrate]', i + 1 + '/', statements.length, preview + '...');
        await client.query(statement + (statement.endsWith(';') ? '' : ';'));
      }
      console.log('[migrate] Holidays table created successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[migrate] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
