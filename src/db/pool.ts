import sql, { ConnectionPool, config as SQLConfig } from 'mssql';
import { QueryParameters, QueryResult } from '../types/index.js';

/**
 * SQL Server Connection Pool Configuration
 * Connects to internal LAN database (192.168.10.31)
 */

const config: SQLConfig = {
  server: process.env.DB_HOST || '192.168.10.31',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'etimetracklite1',
  user: process.env.DB_USER || 'essl',
  password: process.env.DB_PASS || 'essl',
  options: {
    encrypt: false, // Set to true if using Azure SQL
    trustServerCertificate: true, // For self-signed certificates
    enableArithAbort: true,
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '15000', 10),
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: 30000,
  },
};

let pool: ConnectionPool | null = null;
let isConnecting = false;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

/**
 * Initialize the connection pool with retry logic
 */
async function connect(retries: number = 0): Promise<ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (pool && pool.connected) {
      return pool;
    }
    return connect(retries);
  }

  try {
    isConnecting = true;
    console.log(`[DB] Connecting to SQL Server at ${config.server}:${config.port}...`);
    
    pool = await sql.connect(config);
    
    console.log(`[DB] ✓ Connected to database: ${config.database}`);
    
    // Handle connection errors
    pool.on('error', (err: Error) => {
      console.error('[DB] Connection pool error:', err);
      pool = null;
    });

    return pool;
  } catch (err) {
    const error = err as Error;
    console.error(`[DB] ✗ Connection failed (attempt ${retries + 1}/${MAX_RETRIES}):`, error.message);
    
    pool = null;
    
    if (retries < MAX_RETRIES) {
      console.log(`[DB] Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connect(retries + 1);
    }
    
    throw new Error(`Failed to connect to SQL Server after ${MAX_RETRIES} attempts: ${error.message}`);
  } finally {
    isConnecting = false;
  }
}

/**
 * Execute a SQL query with parameters
 * @param sqlQuery - SQL query string with @param placeholders
 * @param params - Object with parameter names and values
 * @returns Query result
 */
async function query<T = any>(
  sqlQuery: string,
  params: QueryParameters = {}
): Promise<QueryResult<T>> {
  try {
    const poolConnection = await connect();
    const request = poolConnection.request();
    
    // Add parameters to the request
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
    
    const result = await request.query<T>(sqlQuery);
    return result;
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Query error:', error.message);
    throw error;
  }
}

/**
 * Execute a stored procedure
 * @param procedureName - Name of the stored procedure
 * @param params - Input parameters
 * @returns Result from stored procedure
 */
async function executeProcedure<T = any>(
  procedureName: string,
  params: QueryParameters = {}
): Promise<QueryResult<T>> {
  try {
    const poolConnection = await connect();
    const request = poolConnection.request();
    
    // Add parameters to the request
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
    
    const result = await request.execute<T>(procedureName);
    return result;
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Stored procedure error:', error.message);
    throw error;
  }
}

/**
 * Get the current connection pool instance
 */
function getPool(): ConnectionPool | null {
  return pool;
}

/**
 * Close the connection pool gracefully
 */
async function closePool(): Promise<void> {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('[DB] Connection pool closed');
    }
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Error closing pool:', error.message);
  }
}

export { connect, query, executeProcedure, getPool, closePool, sql };
export default { connect, query, executeProcedure, getPool, closePool, sql };

