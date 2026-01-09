/**
 * Leave Model
 * Database operations for leave entitlement and monthly usage tracking
 * 
 * Tables:
 * - EmployeeLeaves: Annual leave entitlements (AllowedLeaves, UsedPaidLeaves, UsedCasualLeaves)
 * - MonthlyLeaveUsage: Month-by-month leave approvals (persists across sessions)
 */

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import {
  EmployeeLeaveEntitlement,
  MonthlyLeaveUsage,
  SaveLeaveApprovalRequest,
  LeaveDateWithValue,
} from '../types/index.js';

export class LeaveModel {
  /**
   * Get annual leave entitlement for an employee for a specific year
   * Returns AllowedLeaves and cumulative UsedPaidLeaves/UsedCasualLeaves
   */
  static async getEmployeeLeaveEntitlement(
    employeeCode: string,
    year: number
  ): Promise<EmployeeLeaveEntitlement | null> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('LeaveYear', sql.Int, year)
      .query<EmployeeLeaveEntitlement>(`
        SELECT 
          EmployeeLeavesId,
          EmployeeCode,
          LeaveTypeId,
          LeaveYear,
          AllowedLeaves,
          ISNULL(UsedPaidLeaves, 0) AS UsedPaidLeaves,
          ISNULL(UsedCasualLeaves, 0) AS UsedCasualLeaves
        FROM dbo.EmployeeLeaves
        WHERE EmployeeCode = @EmployeeCode 
          AND LeaveYear = @LeaveYear
      `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Get monthly leave usage for an employee for a specific month
   * Returns which dates were approved as paid/casual leave
   */
  static async getMonthlyLeaveUsage(
    employeeCode: string,
    month: string
  ): Promise<MonthlyLeaveUsage | null> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('LeaveMonth', sql.VarChar(7), month)
      .query<MonthlyLeaveUsage>(`
        SELECT 
          MonthlyLeaveUsageId,
          EmployeeCode,
          LeaveMonth,
          PaidLeaveDaysUsed,
          CasualLeaveDaysUsed,
          PaidLeaveDates,
          CasualLeaveDates,
          CreatedAt,
          UpdatedAt,
          UpdatedBy
        FROM dbo.MonthlyLeaveUsage
        WHERE EmployeeCode = @EmployeeCode 
          AND LeaveMonth = @LeaveMonth
      `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Parse leave dates from database (supports both JSON and legacy comma-separated format)
   * Returns array of { date, value } objects
   */
  static parseLeaveDatesWithValues(
    dateString: string | null,
    defaultValue: number = 1.0
  ): LeaveDateWithValue[] {
    if (!dateString) return [];

    // Check if it's JSON format (starts with '[')
    if (dateString.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(dateString) as LeaveDateWithValue[];
        // Validate structure
        if (Array.isArray(parsed)) {
          return parsed.filter(item => 
            item && 
            typeof item.date === 'string' && 
            typeof item.value === 'number' &&
            (item.value === 0.5 || item.value === 1.0)
          );
        }
      } catch (err) {
        console.warn('[LeaveModel] Failed to parse JSON leave dates, falling back to legacy format:', err);
      }
    }

    // Legacy format: comma-separated dates
    // Convert to { date, value } format with default value
    return dateString
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0)
      .map(date => ({ date, value: defaultValue }));
  }

  /**
   * Convert leave dates with values to JSON string for storage
   */
  static stringifyLeaveDates(dates: LeaveDateWithValue[]): string | null {
    if (dates.length === 0) return null;
    return JSON.stringify(dates);
  }

  /**
   * Save or update monthly leave usage (idempotent operation)
   * Uses stored procedure for atomic upsert
   * Now stores dates as JSON with explicit values (0.5 or 1.0)
   */
  static async upsertMonthlyLeaveUsage(
    data: SaveLeaveApprovalRequest
  ): Promise<{ operation: string; record: MonthlyLeaveUsage }> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    // Calculate sums based on explicit values
    const paidLeaveDaysUsed = data.paidLeaveDates.reduce((sum, item) => sum + item.value, 0);
    const casualLeaveDaysUsed = data.casualLeaveDates.reduce((sum, item) => sum + item.value, 0);

    // Convert to JSON strings for storage
    const paidLeaveDatesStr = data.paidLeaveDates.length > 0 
      ? this.stringifyLeaveDates(data.paidLeaveDates)
      : null;
    const casualLeaveDatesStr = data.casualLeaveDates.length > 0 
      ? this.stringifyLeaveDates(data.casualLeaveDates)
      : null;

    // Execute stored procedure
    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), data.employeeCode)
      .input('LeaveMonth', sql.VarChar(7), data.month)
      .input('PaidLeaveDaysUsed', sql.Decimal(10, 2), paidLeaveDaysUsed) // Changed to Decimal to support 0.5
      .input('CasualLeaveDaysUsed', sql.Decimal(10, 2), casualLeaveDaysUsed) // Changed to Decimal to support 0.5
      .input('PaidLeaveDates', sql.VarChar(500), paidLeaveDatesStr)
      .input('CasualLeaveDates', sql.VarChar(500), casualLeaveDatesStr)
      .input('UpdatedBy', sql.VarChar(100), data.approvedBy || null)
      .execute('dbo.UpsertMonthlyLeaveUsage');

    const operation = result.recordset[0]?.Operation || 'UNKNOWN';

    // Fetch the saved record
    const savedRecord = await this.getMonthlyLeaveUsage(data.employeeCode, data.month);

    if (!savedRecord) {
      throw new Error('Failed to retrieve saved leave usage record');
    }

    return {
      operation,
      record: savedRecord,
    };
  }

  /**
   * Update annual cumulative leave usage in EmployeeLeaves table
   * This is called after saving monthly usage to keep annual totals in sync
   */
  static async updateAnnualLeaveUsage(
    employeeCode: string,
    year: number,
    usedPaidLeaves: number,
    usedCasualLeaves: number
  ): Promise<void> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('LeaveYear', sql.Int, year)
      .input('UsedPaidLeaves', sql.Int, usedPaidLeaves)
      .input('UsedCasualLeaves', sql.Decimal(5, 2), usedCasualLeaves) // Changed to Decimal to support 0.5
      .query(`
        UPDATE dbo.EmployeeLeaves
        SET UsedPaidLeaves = @UsedPaidLeaves,
            UsedCasualLeaves = @UsedCasualLeaves
        WHERE EmployeeCode = @EmployeeCode 
          AND LeaveYear = @LeaveYear
      `);
  }

  /**
   * Get all monthly leave usage for an employee for the entire year
   * Useful for calculating annual totals
   */
  static async getYearlyLeaveUsage(
    employeeCode: string,
    year: number
  ): Promise<MonthlyLeaveUsage[]> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('YearPattern', sql.VarChar(7), `${year}-%`)
      .query<MonthlyLeaveUsage>(`
        SELECT 
          MonthlyLeaveUsageId,
          EmployeeCode,
          LeaveMonth,
          PaidLeaveDaysUsed,
          CasualLeaveDaysUsed,
          PaidLeaveDates,
          CasualLeaveDates,
          CreatedAt,
          UpdatedAt,
          UpdatedBy
        FROM dbo.MonthlyLeaveUsage
        WHERE EmployeeCode = @EmployeeCode 
          AND LeaveMonth LIKE @YearPattern
        ORDER BY LeaveMonth ASC
      `);

    return result.recordset;
  }

  /**
   * Delete monthly leave usage (for canceling approvals)
   */
  static async deleteMonthlyLeaveUsage(
    employeeCode: string,
    month: string
  ): Promise<boolean> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('LeaveMonth', sql.VarChar(7), month)
      .query(`
        DELETE FROM dbo.MonthlyLeaveUsage
        WHERE EmployeeCode = @EmployeeCode 
          AND LeaveMonth = @LeaveMonth
      `);

    return result.rowsAffected[0] > 0;
  }
}

