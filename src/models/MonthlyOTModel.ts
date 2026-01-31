/**
 * MonthlyOT Model
 * Database operations for overtime toggle per employee per month
 * 
 * Table: MonthlyOT
 * - Stores whether overtime is enabled for each employee for each month
 * - Overtime calculation is done dynamically in payroll service
 */

import { query, executeProcedure } from '../db/pool.js';

export interface MonthlyOT {
  Id: number;
  EmployeeCode: string;
  Month: string; // Format: YYYY-MM
  IsOvertimeEnabled: boolean;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export class MonthlyOTModel {
  /**
   * Get overtime status for an employee for a specific month
   */
  static async getOvertimeStatus(
    employeeCode: string,
    month: string
  ): Promise<MonthlyOT | null> {
    try {
      const sqlQuery = `
        SELECT 
          id,
          employeecode,
          month,
          isovertimeenabled,
          createdat,
          updatedat
        FROM monthlyot
        WHERE employeecode = @employeeCode 
          AND month = @month
      `;

      const result = await query<MonthlyOT>(sqlQuery, { employeeCode, month });
      return result.recordset.length > 0 ? this.mapToMonthlyOT(result.recordset[0]) : null;
    } catch (error: any) {
      // If table doesn't exist, return null (overtime disabled by default)
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn(`[MonthlyOT] Table monthlyot does not exist yet. Overtime will be disabled by default.`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Save or update overtime status (idempotent operation)
   * Uses stored procedure if available, otherwise direct SQL upsert
   */
  static async upsertOvertimeStatus(
    employeeCode: string,
    month: string,
    isOvertimeEnabled: boolean
  ): Promise<{ operation: string; record: MonthlyOT }> {
    try {
      const result = await executeProcedure<{ Operation: string }>('sp_upsertmonthlyot', {
        employeeCode,
        month,
        isOvertimeEnabled,
      });

      // Fetch the updated/created record
      const record = await this.getOvertimeStatus(employeeCode, month);
      
      if (!record) {
        throw new Error('Failed to retrieve overtime status after upsert');
      }

      return {
        operation: result.recordset[0]?.Operation || 'updated',
        record
      };
    } catch (error: any) {
      // Only fall back when the procedure/function is missing (not when table is missing from direct SQL)
      if (error.message?.includes('function')) {
        console.warn('[MonthlyOT] Stored procedure not found, using direct SQL upsert');
        return await this.upsertOvertimeStatusDirect(employeeCode, month, isOvertimeEnabled);
      }
      throw error;
    }
  }

  /**
   * Direct SQL upsert (fallback if stored procedure doesn't exist).
   * Uses ON CONFLICT to avoid duplicate key when a row already exists
   * (e.g. getOvertimeStatus returned null due to type/case mismatch).
   */
  private static async upsertOvertimeStatusDirect(
    employeeCode: string,
    month: string,
    isOvertimeEnabled: boolean
  ): Promise<{ operation: string; record: MonthlyOT }> {
    const sqlQuery = `
      INSERT INTO monthlyot (employeecode, month, isovertimeenabled, createdat)
      VALUES (@employeeCode, @month, @isOvertimeEnabled, CURRENT_TIMESTAMP)
      ON CONFLICT (employeecode, month) DO UPDATE SET
        isovertimeenabled = EXCLUDED.isovertimeenabled,
        updatedat = CURRENT_TIMESTAMP
      RETURNING 
        id,
        employeecode,
        month,
        isovertimeenabled,
        createdat,
        updatedat
    `;

    const result = await query<{ id: number; employeecode: string; month: string; isovertimeenabled: boolean; createdat: Date; updatedat: Date | null }>(
      sqlQuery,
      { employeeCode, month, isOvertimeEnabled }
    );

    if (!result.recordset || result.recordset.length === 0) {
      throw new Error('Failed to upsert overtime status');
    }

    const row = result.recordset[0];
    const record = this.mapToMonthlyOT(row);

    return { operation: 'updated', record };
  }

  /**
   * Get overtime status for multiple employees in a month (batch query)
   */
  static async getOvertimeStatusBatch(
    employeeCodes: string[],
    month: string
  ): Promise<Map<string, boolean>> {
    if (employeeCodes.length === 0) {
      return new Map();
    }

    try {
      // Build IN clause with parameterized values
      // PostgreSQL pg library supports arrays, but we need to handle it properly
      const placeholders = employeeCodes.map((_, index) => `$${index + 2}`).join(', ');
      const sqlQuery = `
        SELECT 
          employeecode,
          isovertimeenabled
        FROM monthlyot
        WHERE month = $1
          AND employeecode IN (${placeholders})
      `;

      // Use direct pool query for array support
      const { getPool } = await import('../db/pool.js');
      const pool = getPool();
      if (!pool) {
        throw new Error('Database pool not available');
      }

      const values = [month, ...employeeCodes];
      const pgResult = await pool.query(sqlQuery, values);

      const map = new Map<string, boolean>();
      pgResult.rows.forEach((row: any) => {
        const code = row.employeecode || row.EmployeeCode || '';
        const enabled = row.isovertimeenabled === true || row.isovertimeenabled === 1
          || row.IsOvertimeEnabled === true || row.IsOvertimeEnabled === 1;
        if (code) {
          map.set(code, enabled);
        }
      });

      // Set default false for employees not in database
      employeeCodes.forEach(code => {
        if (!map.has(code)) {
          map.set(code, false);
        }
      });

      return map;
    } catch (error: any) {
      // If table doesn't exist, return all false
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn(`[MonthlyOT] Table monthlyot does not exist yet. All overtime will be disabled.`);
        const map = new Map<string, boolean>();
        employeeCodes.forEach(code => map.set(code, false));
        return map;
      }
      throw error;
    }
  }

  /**
   * Map database row to MonthlyOT interface
   * Handles both lowercase (PostgreSQL) and PascalCase (legacy) column names
   */
  private static mapToMonthlyOT(row: any): MonthlyOT {
    return {
      Id: row.id || row.Id || 0,
      EmployeeCode: row.employeecode || row.EmployeeCode || '',
      Month: row.month || row.Month || '',
      IsOvertimeEnabled: (row.isovertimeenabled === true || row.isovertimeenabled === 1) 
        || (row.IsOvertimeEnabled === true || row.IsOvertimeEnabled === 1) 
        || false,
      CreatedAt: row.createdat || row.CreatedAt || new Date(),
      UpdatedAt: row.updatedat || row.UpdatedAt || null,
    };
  }
}
