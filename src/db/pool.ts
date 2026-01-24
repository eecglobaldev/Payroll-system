/**
 * PostgreSQL Connection Pool
 * Connects to DigitalOcean PostgreSQL database
 */

import { Pool, PoolClient } from 'pg';
import { QueryParameters, QueryResult as AppQueryResult } from '../types/index.js';

// PostgreSQL connection configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'defaultdb',
  user: process.env.DB_USER || 'doadmin',
  password: process.env.DB_PASS || '',
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? {
    rejectUnauthorized: false, // For DigitalOcean managed databases
  } : false,
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
};

let pool: Pool | null = null;
let isConnecting = false;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

/**
 * Initialize the connection pool with retry logic
 */
async function connect(retries: number = 0): Promise<Pool> {
  if (pool) {
    return pool;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (pool) {
      return pool;
    }
    return connect(retries);
  }

  try {
    isConnecting = true;
    const dbHost = poolConfig.host || 'not configured';
    console.log(`[DB] Connecting to PostgreSQL at ${dbHost}:${poolConfig.port}...`);
    
    // Check if DB_HOST is configured
    if (!process.env.DB_HOST || process.env.DB_HOST === 'your-db-host') {
      console.warn('[DB] ⚠ DB_HOST not configured. Set DB_HOST environment variable.');
      throw new Error('DB_HOST environment variable not configured');
    }
    
    pool = new Pool(poolConfig);
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log(`[DB] ✓ Connected to database: ${poolConfig.database}`);
    
    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('[DB] Connection pool error:', err);
      // Don't set pool to null here, let it try to reconnect
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
    
    // Don't throw error - allow server to start without DB
    // Connection will be retried on first database request
    console.warn('[DB] ⚠ Could not establish initial database connection. Server will start but database operations will fail until connection is established.');
    throw new Error(`Failed to connect to PostgreSQL after ${MAX_RETRIES} attempts: ${error.message}`);
  } finally {
    isConnecting = false;
  }
}

/**
 * Convert named parameters to positional parameters for PostgreSQL
 * SQL Server uses @paramName, PostgreSQL uses $1, $2, $3
 */
function convertNamedParamsToPositional(
  sqlQuery: string,
  params: QueryParameters
): { query: string; values: any[] } {
  const paramNames = Object.keys(params);
  if (paramNames.length === 0) {
    return { query: sqlQuery, values: [] };
  }

  // Replace @paramName with $1, $2, etc.
  let convertedQuery = sqlQuery;
  const values: any[] = [];
  let paramIndex = 1;

  // Sort params by length (longer names first) to avoid partial replacements
  const sortedParams = paramNames.sort((a, b) => b.length - a.length);

  for (const paramName of sortedParams) {
    const regex = new RegExp(`@${paramName}\\b`, 'g');
    convertedQuery = convertedQuery.replace(regex, `$${paramIndex}`);
    values.push(params[paramName]);
    paramIndex++;
  }

  return { query: convertedQuery, values };
}

/**
 * Convert SQL Server syntax to PostgreSQL syntax
 */
function convertSQLSyntax(sqlQuery: string): string {
  let converted = sqlQuery;

  // Convert TOP N to LIMIT N
  converted = converted.replace(/TOP\s+(\d+)/gi, 'LIMIT $1');

  // Convert ISNULL to COALESCE
  converted = converted.replace(/ISNULL\s*\(/gi, 'COALESCE(');

  // Convert GETDATE() to CURRENT_TIMESTAMP
  converted = converted.replace(/GETDATE\s*\(\)/gi, 'CURRENT_TIMESTAMP');

  // Convert dbo. schema prefix (remove it, PostgreSQL uses public by default)
  converted = converted.replace(/dbo\./gi, '');

  // Convert CONVERT(date, ...) to DATE(...)
  converted = converted.replace(/CONVERT\s*\(\s*date\s*,\s*([^)]+)\s*\)/gi, 'DATE($1)');

  // Convert table names to lowercase (PostgreSQL convention)
  // This is a simple conversion - be careful with quoted identifiers
  // We'll handle this more carefully in specific queries

  // Convert string concatenation + to ||
  // But be careful not to replace + in numeric expressions
  // This is tricky, so we'll handle it case by case in models

  return converted;
}

/**
 * Execute a SQL query with parameters
 * @param sqlQuery - SQL query string (can use @paramName or $1, $2 syntax)
 * @param params - Object with parameter names and values (for @paramName syntax)
 * @returns Query result
 */
async function query<T = any>(
  sqlQuery: string,
  params: QueryParameters = {}
): Promise<AppQueryResult<T>> {
  try {
    const poolConnection = await connect();
    
    // Convert SQL Server syntax to PostgreSQL
    let convertedQuery = convertSQLSyntax(sqlQuery);
    
    // Convert named parameters to positional if needed
    const { query: finalQuery, values } = convertNamedParamsToPositional(convertedQuery, params);
    
    const result = await poolConnection.query(finalQuery, values);
    
    // Convert PostgreSQL result format to match SQL Server format
    return {
      recordset: result.rows as T[],
      rowsAffected: [result.rowCount || 0],
      returnValue: 0,
    } as unknown as AppQueryResult<T>;
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Query error:', error.message);
    console.error('[DB] Query:', sqlQuery.substring(0, 200));
    throw error;
  }
}

/**
 * Execute a stored procedure (PostgreSQL functions)
 * Note: PostgreSQL uses functions, not stored procedures
 * This is a compatibility wrapper
 * @param functionName - Name of the PostgreSQL function
 * @param params - Input parameters
 * @returns Result from function
 */
async function executeProcedure<T = any>(
  functionName: string,
  params: QueryParameters = {}
): Promise<AppQueryResult<T>> {
  try {
    const poolConnection = await connect();
    
    // Convert params to positional parameters
    const paramNames = Object.keys(params);
    const paramValues = paramNames.map(name => params[name]);
    const paramPlaceholders = paramNames.map((_, index) => `$${index + 1}`).join(', ');
    
    // Call PostgreSQL function
    const sqlQuery = `SELECT * FROM ${functionName}(${paramPlaceholders})`;
    
    const result = await poolConnection.query(sqlQuery, paramValues);
    
    return {
      recordset: result.rows as T[],
      rowsAffected: [result.rowCount || 0],
      returnValue: 0,
    } as unknown as AppQueryResult<T>;
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Function execution error:', error.message);
    throw error;
  }
}

/**
 * Get the current connection pool instance
 */
function getPool(): Pool | null {
  return pool;
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient(): Promise<PoolClient> {
  const poolConnection = await connect();
  return poolConnection.connect();
}

/**
 * Close the connection pool gracefully
 */
async function closePool(): Promise<void> {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      console.log('[DB] Connection pool closed');
    }
  } catch (err) {
    const error = err as Error;
    console.error('[DB] Error closing pool:', error.message);
  }
}

export { connect, query, executeProcedure, getPool, getClient, closePool };
export default { connect, query, executeProcedure, getPool, getClient, closePool };
