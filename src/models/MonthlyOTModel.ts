/**
 * MonthlyOT Model
 * Database operations for overtime toggle per employee per month
 * 
 * Table: MonthlyOT
 * - Stores whether overtime is enabled for each employee for each month
 * - Overtime calculation is done dynamically in payroll service
 */

import sql from 'mssql';
import { getPool } from '../db/pool.js';

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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    try {
      const result = await pool
        .request()
        .input('EmployeeCode', sql.NVarChar(20), employeeCode)
        .input('Month', sql.NVarChar(7), month)
        .query<MonthlyOT>(`
          SELECT 
            Id,
            EmployeeCode,
            Month,
            IsOvertimeEnabled,
            CreatedAt,
            UpdatedAt
          FROM dbo.MonthlyOT
          WHERE EmployeeCode = @EmployeeCode 
            AND Month = @Month
        `);

      return result.recordset.length > 0 ? result.recordset[0] : null;
    } catch (error: any) {
      // If table doesn't exist, return null (overtime disabled by default)
      if (error.message?.includes('Invalid object name') || error.message?.includes('does not exist')) {
        console.warn(`[MonthlyOT] Table MonthlyOT does not exist yet. Overtime will be disabled by default.`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Save or update overtime status (idempotent operation)
   * Uses stored procedure for atomic upsert
   */
  static async upsertOvertimeStatus(
    employeeCode: string,
    month: string,
    isOvertimeEnabled: boolean
  ): Promise<{ operation: string; record: MonthlyOT }> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    try {
      const result = await pool
        .request()
        .input('EmployeeCode', sql.NVarChar(20), employeeCode)
        .input('Month', sql.NVarChar(7), month)
        .input('IsOvertimeEnabled', sql.Bit, isOvertimeEnabled)
        .execute('dbo.sp_UpsertMonthlyOT');

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
      // If stored procedure doesn't exist, try direct SQL
      if (error.message?.includes('Could not find stored procedure')) {
        console.warn('[MonthlyOT] Stored procedure not found, using direct SQL upsert');
        return await this.upsertOvertimeStatusDirect(employeeCode, month, isOvertimeEnabled);
      }
      throw error;
    }
  }

  /**
   * Direct SQL upsert (fallback if stored procedure doesn't exist)
   */
  private static async upsertOvertimeStatusDirect(
    employeeCode: string,
    month: string,
    isOvertimeEnabled: boolean
  ): Promise<{ operation: string; record: MonthlyOT }> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    // Check if record exists
    const existing = await this.getOvertimeStatus(employeeCode, month);

    if (existing) {
      // Update existing record
      await pool
        .request()
        .input('EmployeeCode', sql.NVarChar(20), employeeCode)
        .input('Month', sql.NVarChar(7), month)
        .input('IsOvertimeEnabled', sql.Bit, isOvertimeEnabled)
        .query(`
          UPDATE dbo.MonthlyOT
          SET IsOvertimeEnabled = @IsOvertimeEnabled,
              UpdatedAt = GETDATE()
          WHERE EmployeeCode = @EmployeeCode 
            AND Month = @Month
        `);

      const record = await this.getOvertimeStatus(employeeCode, month);
      if (!record) {
        throw new Error('Failed to retrieve overtime status after update');
      }

      return { operation: 'updated', record };
    } else {
      // Insert new record
      await pool
        .request()
        .input('EmployeeCode', sql.NVarChar(20), employeeCode)
        .input('Month', sql.NVarChar(7), month)
        .input('IsOvertimeEnabled', sql.Bit, isOvertimeEnabled)
        .query(`
          INSERT INTO dbo.MonthlyOT (EmployeeCode, Month, IsOvertimeEnabled, CreatedAt)
          VALUES (@EmployeeCode, @Month, @IsOvertimeEnabled, GETDATE())
        `);

      const record = await this.getOvertimeStatus(employeeCode, month);
      if (!record) {
        throw new Error('Failed to retrieve overtime status after insert');
      }

      return { operation: 'created', record };
    }
  }

  /**
   * Get overtime status for multiple employees in a month (batch query)
   */
  static async getOvertimeStatusBatch(
    employeeCodes: string[],
    month: string
  ): Promise<Map<string, boolean>> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    if (employeeCodes.length === 0) {
      return new Map();
    }

    try {
      // Create a table-valued parameter or use IN clause
      const employeeCodesStr = employeeCodes.map(code => `'${code.replace(/'/g, "''")}'`).join(',');
      
      const result = await pool
        .request()
        .input('Month', sql.NVarChar(7), month)
        .query<MonthlyOT>(`
          SELECT 
            EmployeeCode,
            IsOvertimeEnabled
          FROM dbo.MonthlyOT
          WHERE Month = @Month
            AND EmployeeCode IN (${employeeCodesStr})
        `);

      const map = new Map<string, boolean>();
      result.recordset.forEach(record => {
        map.set(record.EmployeeCode, record.IsOvertimeEnabled);
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
      if (error.message?.includes('Invalid object name') || error.message?.includes('does not exist')) {
        console.warn(`[MonthlyOT] Table MonthlyOT does not exist yet. All overtime will be disabled.`);
        const map = new Map<string, boolean>();
        employeeCodes.forEach(code => map.set(code, false));
        return map;
      }
      throw error;
    }
  }
}

