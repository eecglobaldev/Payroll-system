/**
 * SalaryAdjustment Model
 * Database operations for salary adjustments (deductions and additions)
 * 
 * Tables:
 * - SalaryAdjustments: Stores deductions (e.g., T-shirt cost) and additions (e.g., reimbursements)
 */

import { query, executeProcedure } from '../db/pool.js';

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
    const sqlQuery = `
      SELECT 
        id,
        employeecode,
        month,
        type,
        category,
        amount,
        description,
        createdby,
        createdat,
        updatedat
      FROM salaryadjustments
      WHERE employeecode = @employeeCode 
        AND month = @month
      ORDER BY type, category
    `;

    const result = await query<SalaryAdjustment>(sqlQuery, { employeeCode, month });
    // Map PostgreSQL lowercase column names to PascalCase
    return result.recordset.map(row => this.mapToSalaryAdjustment(row));
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
   * Uses PostgreSQL INSERT ... ON CONFLICT for atomic upsert
   */
  static async upsertAdjustment(
    data: SaveSalaryAdjustmentRequest
  ): Promise<{ operation: string; record: SalaryAdjustment }> {
    // Validate amount
    if (data.amount < 0) {
      throw new Error('Amount must be >= 0');
    }

    // Validate type
    if (data.type !== 'DEDUCTION' && data.type !== 'ADDITION') {
      throw new Error('Type must be DEDUCTION or ADDITION');
    }

    // Try to use stored procedure first, fallback to direct SQL
    try {
      const result = await executeProcedure<{ Operation: string }>('upsertsalaryadjustment', {
        employeeCode: data.employeeCode,
        month: data.month,
        type: data.type,
        category: data.category,
        amount: data.amount,
        description: data.description || null,
        createdBy: data.createdBy || null,
      });

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
    } catch (error: any) {
      // If stored procedure doesn't exist, use direct SQL upsert
      if (error.message?.includes('function') || error.message?.includes('does not exist')) {
        console.warn('[SalaryAdjustment] Stored procedure not found, using direct SQL upsert');
        return await this.upsertAdjustmentDirect(data);
      }
      throw error;
    }
  }

  /**
   * Direct SQL upsert (fallback if stored procedure doesn't exist)
   */
  private static async upsertAdjustmentDirect(
    data: SaveSalaryAdjustmentRequest
  ): Promise<{ operation: string; record: SalaryAdjustment }> {
    const sqlQuery = `
      INSERT INTO salaryadjustments 
        (employeecode, month, type, category, amount, description, createdby)
      VALUES 
        (@employeeCode, @month, @type, @category, @amount, @description, @createdBy)
      ON CONFLICT (employeecode, month, type, category) 
      DO UPDATE SET
        amount = EXCLUDED.amount,
        description = EXCLUDED.description,
        createdby = EXCLUDED.createdby,
        updatedat = CURRENT_TIMESTAMP
      RETURNING 
        id,
        employeecode,
        month,
        type,
        category,
        amount,
        description,
        createdby,
        createdat,
        updatedat
    `;

    const result = await query<SalaryAdjustment>(sqlQuery, {
      employeeCode: data.employeeCode,
      month: data.month,
      type: data.type,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      createdBy: data.createdBy || null,
    });

    if (result.recordset.length === 0) {
      throw new Error('Failed to upsert salary adjustment');
    }

    // Determine operation type by checking if record existed before
    const existing = await this.getAdjustments(data.employeeCode, data.month);
    const operation = existing.length > 1 ? 'updated' : 'created';

    // Map PostgreSQL lowercase column names to PascalCase
    return { operation, record: this.mapToSalaryAdjustment(result.recordset[0]) };
  }

  /**
   * Map database row to SalaryAdjustment interface
   * Handles both lowercase (PostgreSQL) and PascalCase (legacy) column names
   */
  private static mapToSalaryAdjustment(row: any): SalaryAdjustment {
    return {
      Id: row.id || row.Id,
      EmployeeCode: row.employeecode || row.EmployeeCode,
      Month: row.month || row.Month,
      Type: row.type || row.Type,
      Category: row.category || row.Category,
      Amount: parseFloat(String(row.amount || row.Amount || 0)),
      Description: row.description || row.Description || null,
      CreatedBy: row.createdby || row.CreatedBy || null,
      CreatedAt: row.createdat || row.CreatedAt,
      UpdatedAt: row.updatedat || row.UpdatedAt || null,
    };
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
    const sqlQuery = `
      DELETE FROM salaryadjustments
      WHERE employeecode = @employeeCode 
        AND month = @month 
        AND type = @type 
        AND category = @category
    `;

    await query(sqlQuery, { employeeCode, month, type, category });
  }
}
