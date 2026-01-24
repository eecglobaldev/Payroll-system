/**
 * SalaryHold Model
 * Database operations for salary hold functionality
 * 
 * Tables:
 * - SalaryHold: Stores manual and automatic salary holds
 */

import { query } from '../db/pool.js';

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
    const sqlQuery = `
      INSERT INTO salaryhold 
        (employeecode, month, holdtype, reason, actionby, isreleased)
      VALUES 
        (@employeeCode, @month, @holdType, @reason, @actionBy, false)
      RETURNING 
        id,
        employeecode,
        month,
        holdtype,
        reason,
        isreleased,
        createdat,
        releasedat,
        actionby
    `;

    const result = await query<SalaryHold>(sqlQuery, {
      employeeCode: data.employeeCode,
      month: data.month,
      holdType: data.holdType,
      reason: data.reason || null,
      actionBy: data.actionBy || null,
    });

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
    const sqlQuery = `
      SELECT 
        id,
        employeecode,
        month,
        holdtype,
        reason,
        isreleased,
        createdat,
        releasedat,
        actionby
      FROM salaryhold
      WHERE employeecode = @employeeCode 
        AND month = @month
    `;

    const result = await query<SalaryHold>(sqlQuery, { employeeCode, month });

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
    // Check if hold exists
    const existing = await this.isSalaryHeld(employeeCode, month);
    if (!existing) {
      throw new Error(`No active salary hold found for employee ${employeeCode} in month ${month}`);
    }

    const sqlQuery = `
      UPDATE salaryhold
      SET isreleased = true,
          releasedat = CURRENT_TIMESTAMP,
          actionby = COALESCE(@actionBy, actionby)
      WHERE employeecode = @employeeCode 
        AND month = @month
        AND isreleased = false
      RETURNING 
        id,
        employeecode,
        month,
        holdtype,
        reason,
        isreleased,
        createdat,
        releasedat,
        actionby
    `;

    const result = await query<SalaryHold>(sqlQuery, {
      employeeCode,
      month,
      actionBy: actionBy || null,
    });

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
    const sqlQuery = `
      SELECT 
        id,
        employeecode,
        month,
        holdtype,
        reason,
        isreleased,
        createdat,
        releasedat,
        actionby
      FROM salaryhold
      WHERE employeecode = @employeeCode 
        AND month = @month
    `;

    const result = await query<SalaryHold>(sqlQuery, { employeeCode, month });

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
      Id: row.id || row.Id,
      EmployeeCode: row.employeecode || row.EmployeeCode,
      Month: row.month || row.Month,
      HoldType: row.holdtype || row.HoldType,
      Reason: row.reason || row.Reason,
      IsReleased: row.isreleased === true || row.isreleased === 1 || row.IsReleased === true || row.IsReleased === 1,
      CreatedAt: row.createdat || row.CreatedAt,
      ReleasedAt: row.releasedat || row.ReleasedAt,
      ActionBy: row.actionby || row.ActionBy,
    };
  }
}
