// Add status column to PostgreSQL monthlysalary table
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function addStatusColumn() {
  try {
    console.log('Checking if status column exists...');
    
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'monthlysalary' 
      AND LOWER(column_name) = 'status'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Status column already exists in monthlysalary table');
      console.log('Column name:', checkResult.rows[0].column_name);
      
      // Get column details
      const details = await pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'monthlysalary' 
        AND LOWER(column_name) = 'status'
      `);
      
      console.log('Column details:', JSON.stringify(details.rows[0], null, 2));
      await pool.end();
      return;
    }
    
    console.log('❌ Status column does not exist. Adding it...');
    
    // Add status column with default value 1 (FINALIZED)
    // Type: INTEGER, Default: 1, NOT NULL
    await pool.query(`
      ALTER TABLE monthlysalary 
      ADD COLUMN status INTEGER NOT NULL DEFAULT 1
    `);
    
    console.log('✅ Status column added successfully!');
    
    // Verify the column was added
    const verify = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'monthlysalary' 
      AND LOWER(column_name) = 'status'
    `);
    
    console.log('\n✅ Verification - Status column details:');
    console.log(JSON.stringify(verify.rows[0], null, 2));
    
    // Update existing records to have status = 1 (FINALIZED)
    const updateResult = await pool.query(`
      UPDATE monthlysalary 
      SET status = 1 
      WHERE status IS NULL OR status = 0
    `);
    
    console.log(`\n✅ Updated ${updateResult.rowCount} existing records to status = 1 (FINALIZED)`);
    
    await pool.end();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

addStatusColumn();
