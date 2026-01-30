/**
 * Inspect monthlyleaveusage table and related objects using .env credentials.
 * Usage: node scripts/inspect-monthlyleaveusage.cjs (from backend dir)
 */

const path = require('path');
const fs = require('fs');

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const envPaths = [path.join(backendDir, '.env'), path.join(rootDir, '.env')];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('[inspect] Loaded .env from', envPath);
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
    console.error('[inspect] DB_HOST not set.');
    process.exit(1);
  }

  const pool = new Pool(poolConfig);

  try {
    console.log('\n========== 1. TABLE EXISTS? ==========');
    const tableCheck = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'monthlyleaveusage'
    `);
    if (tableCheck.rows.length === 0) {
      console.log('Table monthlyleaveusage does NOT exist.');
      await pool.end();
      return;
    }
    console.log('Table exists:', tableCheck.rows[0].table_schema + '.' + tableCheck.rows[0].table_name);

    console.log('\n========== 2. COLUMNS ==========');
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'monthlyleaveusage'
      ORDER BY ordinal_position
    `);
    cols.rows.forEach((r) => console.log('  ', r.column_name, r.data_type, r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL', r.column_default || ''));

    console.log('\n========== 3. PRIMARY KEY & UNIQUE CONSTRAINTS ==========');
    const pk = await pool.query(`
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'monthlyleaveusage'
      ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position
    `);
    let currentConstraint = null;
    pk.rows.forEach((r) => {
      if (r.constraint_name !== currentConstraint) {
        currentConstraint = r.constraint_name;
        console.log('  ', r.constraint_name, '(' + r.constraint_type + ')');
      }
      console.log('      column:', r.column_name);
    });
    if (pk.rows.length === 0) console.log('  (no constraints found)');

    console.log('\n========== 4. FUNCTION upsertmonthlyleaveusage EXISTS? ==========');
    const funcCheck = await pool.query(`
      SELECT n.nspname AS schema, p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'upsertmonthlyleaveusage'
    `);
    if (funcCheck.rows.length === 0) {
      console.log('  Function upsertmonthlyleaveusage does NOT exist (app will use direct SQL upsert).');
    } else {
      console.log('  Function EXISTS:', funcCheck.rows[0].schema + '.' + funcCheck.rows[0].name);
    }

    console.log('\n========== 5. ROW COUNT ==========');
    const countResult = await pool.query('SELECT COUNT(*) AS cnt FROM monthlyleaveusage');
    console.log('  Total rows:', countResult.rows[0].cnt);

    console.log('\n========== 6. ROWS FOR employeecode = 1454 ==========');
    const emp1454 = await pool.query(
      `SELECT monthlyleaveusageid, employeecode, leavemonth, paidleavedaysused, casualleavedaysused, createdat, updatedat
       FROM monthlyleaveusage WHERE employeecode = $1 ORDER BY leavemonth`,
      ['1454']
    );
    if (emp1454.rows.length === 0) {
      console.log('  No rows for employeecode 1454.');
    } else {
      emp1454.rows.forEach((r, i) => {
        console.log('  Row', i + 1, ':', { monthlyleaveusageid: r.monthlyleaveusageid, employeecode: r.employeecode, leavemonth: r.leavemonth, paidleavedaysused: r.paidleavedaysused, casualleavedaysused: r.casualleavedaysused, createdat: r.createdat, updatedat: r.updatedat });
      });
    }

    console.log('\n========== 7. DUPLICATE (employeecode, leavemonth) CHECK ==========');
    const dupes = await pool.query(`
      SELECT employeecode, leavemonth, COUNT(*) AS cnt
      FROM monthlyleaveusage
      GROUP BY employeecode, leavemonth
      HAVING COUNT(*) > 1
    `);
    if (dupes.rows.length === 0) {
      console.log('  No duplicate (employeecode, leavemonth) pairs.');
    } else {
      console.log('  Duplicates found:');
      dupes.rows.forEach((r) => console.log('   ', r.employeecode, r.leavemonth, 'count:', r.cnt));
    }

    console.log('\n========== 8. SAMPLE ROWS (first 5) ==========');
    const sample = await pool.query(`
      SELECT monthlyleaveusageid, employeecode, leavemonth, paidleavedaysused, casualleavedaysused, createdat
      FROM monthlyleaveusage ORDER BY employeecode, leavemonth LIMIT 5
    `);
    sample.rows.forEach((r, i) => console.log('  ', i + 1, r));

    console.log('\n========== 9. PRIMARY KEY COLUMN(s) ==========');
    const pkCols = await pool.query(`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND a.attnum > 0 AND NOT a.attisdropped
      JOIN pg_class c ON c.oid = i.indrelid
      WHERE c.relname = 'monthlyleaveusage' AND i.indisprimary
      ORDER BY array_position(ARRAY(SELECT unnest(i.indkey)), a.attnum)
    `);
    if (pkCols.rows.length > 0) {
      console.log('  Primary key columns:', pkCols.rows.map((r) => r.column_name).join(', '));
    } else {
      console.log('  (could not determine PK columns)');
    }
  } catch (err) {
    console.error('[inspect] Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
