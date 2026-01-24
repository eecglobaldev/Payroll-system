/**
 * Leave Model
 * Database operations for leave entitlement and monthly usage tracking
 * 
 * Tables:
 * - EmployeeLeaves: Annual leave entitlements (AllowedLeaves, UsedPaidLeaves, UsedCasualLeaves)
 * - MonthlyLeaveUsage: Month-by-month leave approvals (persists across sessions)
 */

import { query, executeProcedure } from '../db/pool.js';
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
    const sqlQuery = `
      SELECT 
        employeeleavesid,
        employeecode,
        leavetypeid,
        leaveyear,
        allowedleaves,
        COALESCE(usedpaidleaves, 0) AS usedpaidleaves,
        COALESCE(usedcasualleaves, 0) AS usedcasualleaves
      FROM employeeleaves
      WHERE employeecode = @employeeCode 
        AND leaveyear = @leaveYear
    `;

    const result = await query<EmployeeLeaveEntitlement>(sqlQuery, { employeeCode, leaveYear: year });
    // Map PostgreSQL lowercase column names to PascalCase
    return result.recordset.length > 0 ? this.mapToEmployeeLeaveEntitlement(result.recordset[0]) : null;
  }

  /**
   * Get monthly leave usage for an employee for a specific month
   * Returns which dates were approved as paid/casual leave
   */
  static async getMonthlyLeaveUsage(
    employeeCode: string,
    month: string
  ): Promise<MonthlyLeaveUsage | null> {
    const sqlQuery = `
      SELECT 
        monthlyleaveusageid,
        employeecode,
        leavemonth,
        paidleavedaysused,
        casualleavedaysused,
        paidleavedates,
        casualleavedates,
        createdat,
        updatedat,
        updatedby
      FROM monthlyleaveusage
      WHERE employeecode = @employeeCode 
        AND leavemonth = @leaveMonth
    `;

    const result = await query<MonthlyLeaveUsage>(sqlQuery, { employeeCode, leaveMonth: month });
    // Map PostgreSQL lowercase column names to PascalCase
    return result.recordset.length > 0 ? this.mapToMonthlyLeaveUsage(result.recordset[0]) : null;
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
   * Uses stored procedure if available, otherwise direct SQL upsert
   * Now stores dates as JSON with explicit values (0.5 or 1.0)
   */
  static async upsertMonthlyLeaveUsage(
    data: SaveLeaveApprovalRequest
  ): Promise<{ operation: string; record: MonthlyLeaveUsage }> {
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

    // Try to use stored procedure first
    try {
      const result = await executeProcedure<{ Operation: string }>('upsertmonthlyleaveusage', {
        employeeCode: data.employeeCode,
        leaveMonth: data.month,
        paidLeaveDaysUsed,
        casualLeaveDaysUsed,
        paidLeaveDates: paidLeaveDatesStr,
        casualLeaveDates: casualLeaveDatesStr,
        updatedBy: data.approvedBy || null,
      });

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
    } catch (error: any) {
      // If stored procedure doesn't exist, use direct SQL upsert
      if (error.message?.includes('function') || error.message?.includes('does not exist')) {
        console.warn('[LeaveModel] Stored procedure not found, using direct SQL upsert');
        return await this.upsertMonthlyLeaveUsageDirect(data, paidLeaveDaysUsed, casualLeaveDaysUsed, paidLeaveDatesStr, casualLeaveDatesStr);
      }
      throw error;
    }
  }

  /**
   * Direct SQL upsert (fallback if stored procedure doesn't exist)
   */
  private static async upsertMonthlyLeaveUsageDirect(
    data: SaveLeaveApprovalRequest,
    paidLeaveDaysUsed: number,
    casualLeaveDaysUsed: number,
    paidLeaveDatesStr: string | null,
    casualLeaveDatesStr: string | null
  ): Promise<{ operation: string; record: MonthlyLeaveUsage }> {
    const sqlQuery = `
      INSERT INTO monthlyleaveusage 
        (employeecode, leavemonth, paidleavedaysused, casualleavedaysused, paidleavedates, casualleavedates, updatedby)
      VALUES 
        (@employeeCode, @leaveMonth, @paidLeaveDaysUsed, @casualLeaveDaysUsed, @paidLeaveDates, @casualLeaveDates, @updatedBy)
      ON CONFLICT (employeecode, leavemonth) 
      DO UPDATE SET
        paidleavedaysused = EXCLUDED.paidleavedaysused,
        casualleavedaysused = EXCLUDED.casualleavedaysused,
        paidleavedates = EXCLUDED.paidleavedates,
        casualleavedates = EXCLUDED.casualleavedates,
        updatedat = CURRENT_TIMESTAMP,
        updatedby = EXCLUDED.updatedby
      RETURNING 
        monthlyleaveusageid,
        employeecode,
        leavemonth,
        paidleavedaysused,
        casualleavedaysused,
        paidleavedates,
        casualleavedates,
        createdat,
        updatedat,
        updatedby
    `;

    const result = await query<MonthlyLeaveUsage>(sqlQuery, {
      employeeCode: data.employeeCode,
      leaveMonth: data.month,
      paidLeaveDaysUsed,
      casualLeaveDaysUsed,
      paidLeaveDates: paidLeaveDatesStr,
      casualLeaveDates: casualLeaveDatesStr,
      updatedBy: data.approvedBy || null,
    });

    if (result.recordset.length === 0) {
      throw new Error('Failed to upsert monthly leave usage');
    }

    // Determine operation type
    const existing = await this.getMonthlyLeaveUsage(data.employeeCode, data.month);
    const operation = existing ? 'updated' : 'created';

    // Map PostgreSQL lowercase column names to PascalCase
    return {
      operation,
      record: this.mapToMonthlyLeaveUsage(result.recordset[0]),
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
    const sqlQuery = `
      UPDATE employeeleaves
      SET usedpaidleaves = @usedPaidLeaves,
          usedcasualleaves = @usedCasualLeaves
      WHERE employeecode = @employeeCode 
        AND leaveyear = @leaveYear
    `;

    await query(sqlQuery, {
      employeeCode,
      leaveYear: year,
      usedPaidLeaves,
      usedCasualLeaves,
    });
  }

  /**
   * Get all monthly leave usage for an employee for the entire year
   * Useful for calculating annual totals
   */
  static async getYearlyLeaveUsage(
    employeeCode: string,
    year: number
  ): Promise<MonthlyLeaveUsage[]> {
    const sqlQuery = `
      SELECT 
        monthlyleaveusageid,
        employeecode,
        leavemonth,
        paidleavedaysused,
        casualleavedaysused,
        paidleavedates,
        casualleavedates,
        createdat,
        updatedat,
        updatedby
      FROM monthlyleaveusage
      WHERE employeecode = @employeeCode 
        AND leavemonth LIKE @yearPattern
      ORDER BY leavemonth ASC
    `;

    const result = await query<MonthlyLeaveUsage>(sqlQuery, {
      employeeCode,
      yearPattern: `${year}-%`,
    });

    // Map PostgreSQL lowercase column names to PascalCase
    return result.recordset.map(row => this.mapToMonthlyLeaveUsage(row));
  }

  /**
   * Map database row to EmployeeLeaveEntitlement interface
   * Handles both lowercase (PostgreSQL) and PascalCase (legacy) column names
   */
  private static mapToEmployeeLeaveEntitlement(row: any): EmployeeLeaveEntitlement {
    return {
      EmployeeLeavesId: row.employeeleavesid || row.EmployeeLeavesId,
      EmployeeCode: row.employeecode || row.EmployeeCode,
      LeaveTypeId: row.leavetypeid || row.LeaveTypeId,
      LeaveYear: row.leaveyear || row.LeaveYear,
      AllowedLeaves: parseFloat(String(row.allowedleaves || row.AllowedLeaves || 0)),
      UsedPaidLeaves: parseFloat(String(row.usedpaidleaves || row.UsedPaidLeaves || 0)),
      UsedCasualLeaves: parseFloat(String(row.usedcasualleaves || row.UsedCasualLeaves || 0)),
    };
  }

  /**
   * Map database row to MonthlyLeaveUsage interface
   * Handles both lowercase (PostgreSQL) and PascalCase (legacy) column names
   */
  private static mapToMonthlyLeaveUsage(row: any): MonthlyLeaveUsage {
    return {
      MonthlyLeaveUsageId: row.monthlyleaveusageid || row.MonthlyLeaveUsageId,
      EmployeeCode: row.employeecode || row.EmployeeCode,
      LeaveMonth: row.leavemonth || row.LeaveMonth,
      PaidLeaveDaysUsed: parseFloat(String(row.paidleavedaysused || row.PaidLeaveDaysUsed || 0)),
      CasualLeaveDaysUsed: parseFloat(String(row.casualleavedaysused || row.CasualLeaveDaysUsed || 0)),
      PaidLeaveDates: row.paidleavedates || row.PaidLeaveDates || null,
      CasualLeaveDates: row.casualleavedates || row.CasualLeaveDates || null,
      CreatedAt: row.createdat || row.CreatedAt,
      UpdatedAt: row.updatedat || row.UpdatedAt || null,
      UpdatedBy: row.updatedby || row.UpdatedBy || null,
    };
  }

  /**
   * Delete monthly leave usage (for canceling approvals)
   */
  static async deleteMonthlyLeaveUsage(
    employeeCode: string,
    month: string
  ): Promise<boolean> {
    const sqlQuery = `
      DELETE FROM monthlyleaveusage
      WHERE employeecode = @employeeCode 
        AND leavemonth = @leaveMonth
    `;

    const result = await query(sqlQuery, { employeeCode, leaveMonth: month });
    return result.rowsAffected[0] > 0;
  }
}
