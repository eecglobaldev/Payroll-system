// Check local SQL Server database for status column
const sql = require('mssql');

const config = {
  server: 'localhost',
  port: 1433,
  database: 'etimetracklite1',
  user: 'essl',
  password: 'essl',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkStatusColumn() {
  try {
    console.log('Connecting to local SQL Server database...');
    const pool = await sql.connect(config);
    
    // Check if monthlysalary table exists and get its columns
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'monthlysalary'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColumns in monthlysalary table (SQL Server):');
    result.recordset.forEach(row => {
      console.log(`  - ${row.COLUMN_NAME} (${row.DATA_TYPE}, nullable: ${row.IS_NULLABLE}, default: ${row.COLUMN_DEFAULT || 'NULL'})`);
    });
    
    // Check specifically for status column
    const statusColumn = result.recordset.find(col => 
      col.COLUMN_NAME.toLowerCase() === 'status'
    );
    
    if (statusColumn) {
      console.log('\n✅ Status column found:');
      console.log(JSON.stringify(statusColumn, null, 2));
    } else {
      console.log('\n❌ Status column NOT found in monthlysalary table');
    }
    
    await pool.close();
    console.log('\n✅ Connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Could not connect to SQL Server. Is it running on localhost:1433?');
    }
    process.exit(1);
  }
}

checkStatusColumn();
