/**
 * SalaryAdjustment Model
 * Database operations for salary adjustments (deductions and additions)
 * 
 * Tables:
 * - SalaryAdjustments: Stores deductions (e.g., T-shirt cost) and additions (e.g., reimbursements)
 */

import sql from 'mssql';
import { getPool } from '../db/pool.js';

export interface SalaryAdjustment {
  Id: number;
  EmployeeCode: string;
  Month: string; // YYYY-MM format
  Type: 'DEDUCTION' | 'ADDITION';
  Category: string; // e.g., 'T_SHIRT', 'REIMBURSEMENT'
  Amount: number;
  Description: string | null;
  CreatedBy: string | null;
  CreatedAt: Date;
  UpdatedAt: Date | null;
}

export interface SaveSalaryAdjustmentRequest {
  employeeCode: string;
  month: string; // YYYY-MM format
  type: 'DEDUCTION' | 'ADDITION';
  category: string;
  amount: number;
  description?: string;
  createdBy?: string;
}

export interface SalaryAdjustmentSummary {
  totalDeductions: number;
  totalAdditions: number;
  adjustments: SalaryAdjustment[];
}

export class SalaryAdjustmentModel {
  /**
   * Get all salary adjustments for an employee for a specific month
   * Returns empty array if none found
   */
  static async getAdjustments(
    employeeCode: string,
    month: string
  ): Promise<SalaryAdjustment[]> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .query<SalaryAdjustment>(`
        SELECT 
          Id,
          EmployeeCode,
          Month,
          Type,
          Category,
          Amount,
          Description,
          CreatedBy,
          CreatedAt,
          UpdatedAt
        FROM dbo.SalaryAdjustments
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month
        ORDER BY Type, Category
      `);

    return result.recordset;
  }

  /**
   * Get salary adjustment summary (totals) for an employee for a specific month
   * Returns summary with total deductions, total additions, and all adjustments
   */
  static async getAdjustmentSummary(
    employeeCode: string,
    month: string
  ): Promise<SalaryAdjustmentSummary> {
    const adjustments = await this.getAdjustments(employeeCode, month);
    
    const totalDeductions = adjustments
      .filter(a => a.Type === 'DEDUCTION')
      .reduce((sum, a) => sum + a.Amount, 0);
    
    const totalAdditions = adjustments
      .filter(a => a.Type === 'ADDITION')
      .reduce((sum, a) => sum + a.Amount, 0);
    
    return {
      totalDeductions: parseFloat(totalDeductions.toFixed(2)),
      totalAdditions: parseFloat(totalAdditions.toFixed(2)),
      adjustments,
    };
  }

  /**
   * Save or update salary adjustment (idempotent operation)
   * Uses stored procedure for atomic upsert
   */
  static async upsertAdjustment(
    data: SaveSalaryAdjustmentRequest
  ): Promise<{ operation: string; record: SalaryAdjustment }> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    // Validate amount
    if (data.amount < 0) {
      throw new Error('Amount must be >= 0');
    }

    // Validate type
    if (data.type !== 'DEDUCTION' && data.type !== 'ADDITION') {
      throw new Error('Type must be DEDUCTION or ADDITION');
    }

    // Call stored procedure
    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(20), data.employeeCode)
      .input('Month', sql.NVarChar(7), data.month)
      .input('Type', sql.NVarChar(20), data.type)
      .input('Category', sql.NVarChar(50), data.category)
      .input('Amount', sql.Decimal(10, 2), data.amount)
      .input('Description', sql.NVarChar(255), data.description || null)
      .input('CreatedBy', sql.NVarChar(50), data.createdBy || null)
      .execute('dbo.UpsertSalaryAdjustment');

    const operation = result.recordset[0]?.Operation || 'UNKNOWN';

    // Fetch the updated/inserted record
    const adjustments = await this.getAdjustments(data.employeeCode, data.month);
    const record = adjustments.find(
      a => a.Type === data.type && a.Category === data.category
    );

    if (!record) {
      throw new Error('Failed to retrieve saved adjustment');
    }

    return { operation, record };
  }

  /**
   * Delete a specific salary adjustment
   */
  static async deleteAdjustment(
    employeeCode: string,
    month: string,
    type: 'DEDUCTION' | 'ADDITION',
    category: string
  ): Promise<void> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .input('Type', sql.NVarChar(20), type)
      .input('Category', sql.NVarChar(50), category)
      .query(`
        DELETE FROM dbo.SalaryAdjustments
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month 
          AND Type = @Type 
          AND Category = @Category
      `);
  }
}

