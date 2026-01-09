/**
 * SalaryHold Model
 * Database operations for salary hold functionality
 * 
 * Tables:
 * - SalaryHold: Stores manual and automatic salary holds
 */

import sql from 'mssql';
import { getPool } from '../db/pool.js';

export interface SalaryHold {
  Id: number;
  EmployeeCode: string;
  Month: string; // YYYY-MM format
  HoldType: 'MANUAL' | 'AUTO';
  Reason: string | null;
  IsReleased: boolean;
  CreatedAt: Date;
  ReleasedAt: Date | null;
  ActionBy: string | null;
}

export interface CreateSalaryHoldRequest {
  employeeCode: string;
  month: string; // YYYY-MM format
  holdType: 'MANUAL' | 'AUTO';
  reason?: string;
  actionBy?: string;
}

export class SalaryHoldModel {
  /**
   * Create a new salary hold
   * Returns the created hold record
   */
  static async createHold(
    data: CreateSalaryHoldRequest
  ): Promise<SalaryHold> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    // Validate hold type
    if (data.holdType !== 'MANUAL' && data.holdType !== 'AUTO') {
      throw new Error('HoldType must be MANUAL or AUTO');
    }

    // Check if hold already exists for this employee and month
    const existing = await this.isSalaryHeld(data.employeeCode, data.month);
    if (existing && !existing.IsReleased) {
      throw new Error(`Salary is already held for employee ${data.employeeCode} in month ${data.month}`);
    }

    // If existing hold is released, we can create a new one
    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), data.employeeCode)
      .input('Month', sql.NVarChar(7), data.month)
      .input('HoldType', sql.NVarChar(20), data.holdType)
      .input('Reason', sql.NVarChar(255), data.reason || null)
      .input('ActionBy', sql.NVarChar(50), data.actionBy || null)
      .query<SalaryHold>(`
        INSERT INTO dbo.SalaryHold 
          (EmployeeCode, Month, HoldType, Reason, ActionBy, IsReleased)
        VALUES 
          (@EmployeeCode, @Month, @HoldType, @Reason, @ActionBy, 0)
        
        SELECT 
          Id,
          EmployeeCode,
          Month,
          HoldType,
          Reason,
          IsReleased,
          CreatedAt,
          ReleasedAt,
          ActionBy
        FROM dbo.SalaryHold
        WHERE Id = SCOPE_IDENTITY()
      `);

    if (result.recordset.length === 0) {
      throw new Error('Failed to create salary hold');
    }

    return this.mapToSalaryHold(result.recordset[0]);
  }

  /**
   * Check if salary is held for an employee in a given month
   * Returns the hold record if exists and not released, null otherwise
   */
  static async isSalaryHeld(
    employeeCode: string,
    month: string
  ): Promise<SalaryHold | null> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .query<SalaryHold>(`
        SELECT 
          Id,
          EmployeeCode,
          Month,
          HoldType,
          Reason,
          IsReleased,
          CreatedAt,
          ReleasedAt,
          ActionBy
        FROM dbo.SalaryHold
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const hold = this.mapToSalaryHold(result.recordset[0]);
    
    // Return null if released (salary is not held)
    if (hold.IsReleased) {
      return null;
    }

    return hold;
  }

  /**
   * Release a salary hold
   * Sets IsReleased = 1 and ReleasedAt = current timestamp
   */
  static async releaseHold(
    employeeCode: string,
    month: string,
    actionBy?: string
  ): Promise<SalaryHold> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    // Check if hold exists
    const existing = await this.isSalaryHeld(employeeCode, month);
    if (!existing) {
      throw new Error(`No active salary hold found for employee ${employeeCode} in month ${month}`);
    }

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .input('ActionBy', sql.NVarChar(50), actionBy || null)
      .query<SalaryHold>(`
        UPDATE dbo.SalaryHold
        SET IsReleased = 1,
            ReleasedAt = GETDATE(),
            ActionBy = COALESCE(@ActionBy, ActionBy)
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month
          AND IsReleased = 0
        
        SELECT 
          Id,
          EmployeeCode,
          Month,
          HoldType,
          Reason,
          IsReleased,
          CreatedAt,
          ReleasedAt,
          ActionBy
        FROM dbo.SalaryHold
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month
      `);

    if (result.recordset.length === 0) {
      throw new Error('Failed to release salary hold');
    }

    return this.mapToSalaryHold(result.recordset[0]);
  }

  /**
   * Get hold record for an employee and month (including released)
   */
  static async getHold(
    employeeCode: string,
    month: string
  ): Promise<SalaryHold | null> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .query<SalaryHold>(`
        SELECT 
          Id,
          EmployeeCode,
          Month,
          HoldType,
          Reason,
          IsReleased,
          CreatedAt,
          ReleasedAt,
          ActionBy
        FROM dbo.SalaryHold
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToSalaryHold(result.recordset[0]);
  }

  /**
   * Map database row to SalaryHold interface
   */
  private static mapToSalaryHold(row: any): SalaryHold {
    return {
      Id: row.Id,
      EmployeeCode: row.EmployeeCode,
      Month: row.Month,
      HoldType: row.HoldType,
      Reason: row.Reason,
      IsReleased: row.IsReleased === true || row.IsReleased === 1,
      CreatedAt: row.CreatedAt,
      ReleasedAt: row.ReleasedAt,
      ActionBy: row.ActionBy,
    };
  }
}

