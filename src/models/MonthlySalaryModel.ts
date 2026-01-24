/**
 * MonthlySalary Model
 * Database operations for monthly salary snapshots
 * 
 * This table stores calculated salary as a single source of truth.
 * Admin portal calculates and saves here, employee portal only reads.
 */

import { query } from '../db/pool.js';

export interface MonthlySalary {
  Id: number;
  EmployeeCode: string;
  Month: string; // YYYY-MM format
  GrossSalary: number | null;
  NetSalary: number | null;
  BaseSalary: number | null;
  PaidDays: number | null;
  AbsentDays: number | null;
  LeaveDays: number | null;
  TotalDeductions: number | null;
  TotalAdditions: number | null;
  IsHeld: boolean;
  HoldReason: string | null;
  CalculatedAt: Date;
  CalculatedBy: string | null;
  Status: number; // 0 = DRAFT, 1 = FINALIZED
  PerDayRate: number | null;
  TotalWorkedHours: number | null;
  OvertimeHours: number | null;
  OvertimeAmount: number | null;
  TdsDeduction: number | null;
  ProfessionalTax: number | null;
  IncentiveAmount: number | null;
  BreakdownJson: string | null;
}

export interface CreateMonthlySalaryRequest {
  employeeCode: string;
  month: string; // YYYY-MM format
  grossSalary: number;
  netSalary: number;
  baseSalary: number;
  paidDays: number;
  absentDays: number;
  leaveDays: number;
  totalDeductions: number;
  totalAdditions: number;
  isHeld: boolean;
  holdReason?: string | null;
  calculatedBy?: string | null;
  perDayRate?: number;
  totalWorkedHours?: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  tdsDeduction?: number;
  professionalTax?: number;
  incentiveAmount?: number;
  breakdownJson?: string | null;
  status?: number; // 0 = DRAFT, 1 = FINALIZED (default: 0)
}

export class MonthlySalaryModel {
  /**
   * Create or update monthly salary snapshot
   * Uses PostgreSQL INSERT ... ON CONFLICT for upsert
   */
  static async upsertSalary(
    data: CreateMonthlySalaryRequest
  ): Promise<MonthlySalary> {
    const sqlQuery = `
      INSERT INTO monthlysalary (
        employeecode, month, grosssalary, netsalary, basesalary,
        paiddays, absentdays, leavedays, totaldeductions, totaladditions,
        isheld, holdreason, calculatedby, status,
        perdayrate, totalworkedhours, overtimehours, overtimeamount,
        tdsdeduction, professionaltax, incentiveamount, breakdownjson
      )
      VALUES (
        @employeeCode, @month, @grossSalary, @netSalary, @baseSalary,
        @paidDays, @absentDays, @leaveDays, @totalDeductions, @totalAdditions,
        @isHeld, @holdReason, @calculatedBy, @status,
        @perDayRate, @totalWorkedHours, @overtimeHours, @overtimeAmount,
        @tdsDeduction, @professionalTax, @incentiveAmount, @breakdownJson
      )
      ON CONFLICT (employeecode, month) 
      DO UPDATE SET
        grosssalary = EXCLUDED.grosssalary,
        netsalary = EXCLUDED.netsalary,
        basesalary = EXCLUDED.basesalary,
        paiddays = EXCLUDED.paiddays,
        absentdays = EXCLUDED.absentdays,
        leavedays = EXCLUDED.leavedays,
        totaldeductions = EXCLUDED.totaldeductions,
        totaladditions = EXCLUDED.totaladditions,
        isheld = EXCLUDED.isheld,
        holdreason = EXCLUDED.holdreason,
        calculatedat = CURRENT_TIMESTAMP,
        calculatedby = EXCLUDED.calculatedby,
        status = EXCLUDED.status,
        perdayrate = EXCLUDED.perdayrate,
        totalworkedhours = EXCLUDED.totalworkedhours,
        overtimehours = EXCLUDED.overtimehours,
        overtimeamount = EXCLUDED.overtimeamount,
        tdsdeduction = EXCLUDED.tdsdeduction,
        professionaltax = EXCLUDED.professionaltax,
        incentiveamount = EXCLUDED.incentiveamount,
        breakdownjson = EXCLUDED.breakdownjson
      RETURNING 
        id, employeecode, month, grosssalary, netsalary, basesalary,
        paiddays, absentdays, leavedays, totaldeductions, totaladditions,
        isheld, holdreason, calculatedat, calculatedby, status,
        perdayrate, totalworkedhours, overtimehours, overtimeamount,
        tdsdeduction, professionaltax, incentiveamount, breakdownjson
    `;

    const result = await query<MonthlySalary>(sqlQuery, {
      employeeCode: data.employeeCode,
      month: data.month,
      grossSalary: data.grossSalary,
      netSalary: data.netSalary,
      baseSalary: data.baseSalary,
      paidDays: data.paidDays,
      absentDays: data.absentDays,
      leaveDays: data.leaveDays,
      totalDeductions: data.totalDeductions,
      totalAdditions: data.totalAdditions,
      isHeld: data.isHeld,
      holdReason: data.holdReason || null,
      calculatedBy: data.calculatedBy || null,
      status: data.status !== undefined ? data.status : 0,
      perDayRate: data.perDayRate || null,
      totalWorkedHours: data.totalWorkedHours || null,
      overtimeHours: data.overtimeHours || null,
      overtimeAmount: data.overtimeAmount || null,
      tdsDeduction: data.tdsDeduction || null,
      professionalTax: data.professionalTax || null,
      incentiveAmount: data.incentiveAmount || null,
      breakdownJson: data.breakdownJson || null,
    });

    if (result.recordset.length === 0) {
      throw new Error('Failed to upsert monthly salary');
    }

    return this.mapToMonthlySalary(result.recordset[0]);
  }

  /**
   * Get monthly salary for an employee and month
   * Returns null if not found (salary not generated yet)
   * @param finalizedOnly - If true, only returns salary with Status = 1 (FINALIZED)
   */
  static async getSalary(
    employeeCode: string,
    month: string,
    finalizedOnly: boolean = false
  ): Promise<MonthlySalary | null> {
    try {
      const statusFilter = finalizedOnly ? 'AND status = 1' : '';
      const sqlQuery = `
        SELECT 
          id, employeecode, month, grosssalary, netsalary, basesalary,
          paiddays, absentdays, leavedays, totaldeductions, totaladditions,
          isheld, holdreason, calculatedat, calculatedby, status,
          perdayrate, totalworkedhours, overtimehours, overtimeamount,
          tdsdeduction, professionaltax, incentiveamount, breakdownjson
        FROM monthlysalary
        WHERE employeecode = @employeeCode AND month = @month ${statusFilter}
      `;

      console.log('[MonthlySalaryModel] getSalary query:', {
        employeeCode,
        month,
        finalizedOnly,
        sqlQuery: sqlQuery.substring(0, 200),
      });

      const result = await query<MonthlySalary>(sqlQuery, { employeeCode, month });

      console.log('[MonthlySalaryModel] getSalary result:', {
        recordCount: result.recordset.length,
        hasRecords: result.recordset.length > 0,
      });

      if (result.recordset.length === 0) {
        return null;
      }

      const mapped = this.mapToMonthlySalary(result.recordset[0]);
      console.log('[MonthlySalaryModel] Mapped salary:', {
        month: mapped.Month,
        employeeCode: mapped.EmployeeCode,
        grossSalary: mapped.GrossSalary,
        netSalary: mapped.NetSalary,
      });
      return mapped;
    } catch (error) {
      const err = error as Error;
      console.error('[MonthlySalaryModel] Error in getSalary:', err.message);
      console.error('[MonthlySalaryModel] Error stack:', err.stack);
      throw err;
    }
  }

  /**
   * Get latest salary for an employee (most recent month)
   * Returns null if no salary records exist
   * @param finalizedOnly - If true, only returns salary with Status = 1 (FINALIZED)
   */
  static async getLatestSalary(
    employeeCode: string,
    finalizedOnly: boolean = false
  ): Promise<MonthlySalary | null> {
    try {
      const statusFilter = finalizedOnly ? 'AND status = 1' : '';
      const sqlQuery = `
        SELECT 
          id, employeecode, month, grosssalary, netsalary, basesalary,
          paiddays, absentdays, leavedays, totaldeductions, totaladditions,
          isheld, holdreason, calculatedat, calculatedby, status,
          perdayrate, totalworkedhours, overtimehours, overtimeamount,
          tdsdeduction, professionaltax, incentiveamount, breakdownjson
        FROM monthlysalary
        WHERE employeecode = @employeeCode ${statusFilter}
        ORDER BY month DESC
        LIMIT 1
      `;

      console.log('[MonthlySalaryModel] getLatestSalary query:', {
        employeeCode,
        finalizedOnly,
        sqlQuery: sqlQuery.substring(0, 200),
      });

      const result = await query<MonthlySalary>(sqlQuery, { employeeCode });

      console.log('[MonthlySalaryModel] getLatestSalary result:', {
        recordCount: result.recordset.length,
        hasRecords: result.recordset.length > 0,
      });

      if (result.recordset.length === 0) {
        return null;
      }

      const mapped = this.mapToMonthlySalary(result.recordset[0]);
      console.log('[MonthlySalaryModel] Mapped latest salary:', {
        month: mapped.Month,
        employeeCode: mapped.EmployeeCode,
      });
      return mapped;
    } catch (error) {
      const err = error as Error;
      console.error('[MonthlySalaryModel] Error in getLatestSalary:', err.message);
      console.error('[MonthlySalaryModel] Error stack:', err.stack);
      throw err;
    }
  }

  /**
   * Get salary history for an employee (last N months)
   * Returns array of monthly salaries, ordered by month DESC
   * @param finalizedOnly - If true, only returns salaries with Status = 1 (FINALIZED)
   */
  static async getSalaryHistory(
    employeeCode: string,
    limit: number = 12,
    finalizedOnly: boolean = false
  ): Promise<MonthlySalary[]> {
    const statusFilter = finalizedOnly ? 'AND status = 1' : '';
    const sqlQuery = `
      SELECT 
        id, employeecode, month, grosssalary, netsalary, basesalary,
        paiddays, absentdays, leavedays, totaldeductions, totaladditions,
        isheld, holdreason, calculatedat, calculatedby, status,
        perdayrate, totalworkedhours, overtimehours, overtimeamount,
        tdsdeduction, professionaltax, incentiveamount, breakdownjson
      FROM monthlysalary
      WHERE employeecode = @employeeCode ${statusFilter}
      ORDER BY month DESC
      LIMIT @limit
    `;

    const result = await query<MonthlySalary>(sqlQuery, { employeeCode, limit });
    return result.recordset.map(row => this.mapToMonthlySalary(row));
  }

  /**
   * Finalize salary for an employee and month
   * Updates Status to 1 (FINALIZED) and sets CalculatedAt/CalculatedBy
   * Only finalizes if current Status is 0 (DRAFT)
   */
  static async finalizeSalary(
    employeeCode: string,
    month: string,
    calculatedBy: string
  ): Promise<MonthlySalary | null> {
    const sqlQuery = `
      UPDATE monthlysalary
      SET status = 1,
          calculatedat = CURRENT_TIMESTAMP,
          calculatedby = @calculatedBy
      WHERE employeecode = @employeeCode 
        AND month = @month 
        AND status = 0
      RETURNING 
        id, employeecode, month, grosssalary, netsalary, basesalary,
        paiddays, absentdays, leavedays, totaldeductions, totaladditions,
        isheld, holdreason, calculatedat, calculatedby, status,
        perdayrate, totalworkedhours, overtimehours, overtimeamount,
        tdsdeduction, professionaltax, incentiveamount, breakdownjson
    `;

    const result = await query<MonthlySalary>(sqlQuery, {
      employeeCode,
      month,
      calculatedBy,
    });

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToMonthlySalary(result.recordset[0]);
  }

  /**
   * Finalize all salaries for a specific month
   * Updates Status to 1 (FINALIZED) for all DRAFT salaries in the month
   */
  static async finalizeAllSalariesForMonth(
    month: string,
    calculatedBy: string
  ): Promise<{ updated: number }> {
    const sqlQuery = `
      UPDATE monthlysalary
      SET status = 1,
          calculatedat = CURRENT_TIMESTAMP,
          calculatedby = @calculatedBy
      WHERE month = @month 
        AND status = 0
    `;

    const result = await query(sqlQuery, { month, calculatedBy });
    const rowsAffected = result.rowsAffected[0] || 0;
    return { updated: rowsAffected };
  }

  /**
   * Map database row to MonthlySalary interface
   */
  private static mapToMonthlySalary(row: any): MonthlySalary {
    console.log('[MonthlySalaryModel] Mapping row to MonthlySalary:', {
      hasId: !!row.id,
      hasEmployeeCode: !!row.employeecode,
      hasMonth: !!row.month,
      rowKeys: Object.keys(row),
    });
    
    try {
      const mapped = {
      Id: row.id || row.Id,
      EmployeeCode: row.employeecode || row.EmployeeCode,
      Month: row.month || row.Month,
      GrossSalary: row.grosssalary !== null && row.grosssalary !== undefined ? parseFloat(row.grosssalary) : (row.GrossSalary !== null && row.GrossSalary !== undefined ? parseFloat(row.GrossSalary) : null),
      NetSalary: row.netsalary !== null && row.netsalary !== undefined ? parseFloat(row.netsalary) : (row.NetSalary !== null && row.NetSalary !== undefined ? parseFloat(row.NetSalary) : null),
      BaseSalary: row.basesalary !== null && row.basesalary !== undefined ? parseFloat(row.basesalary) : (row.BaseSalary !== null && row.BaseSalary !== undefined ? parseFloat(row.BaseSalary) : null),
      PaidDays: row.paiddays !== null && row.paiddays !== undefined ? parseFloat(row.paiddays) : (row.PaidDays !== null && row.PaidDays !== undefined ? parseFloat(row.PaidDays) : null),
      AbsentDays: row.absentdays !== null && row.absentdays !== undefined ? parseFloat(row.absentdays) : (row.AbsentDays !== null && row.AbsentDays !== undefined ? parseFloat(row.AbsentDays) : null),
      LeaveDays: row.leavedays !== null && row.leavedays !== undefined ? parseFloat(row.leavedays) : (row.LeaveDays !== null && row.LeaveDays !== undefined ? parseFloat(row.LeaveDays) : null),
      TotalDeductions: row.totaldeductions !== null && row.totaldeductions !== undefined ? parseFloat(row.totaldeductions) : (row.TotalDeductions !== null && row.TotalDeductions !== undefined ? parseFloat(row.TotalDeductions) : null),
      TotalAdditions: row.totaladditions !== null && row.totaladditions !== undefined ? parseFloat(row.totaladditions) : (row.TotalAdditions !== null && row.TotalAdditions !== undefined ? parseFloat(row.TotalAdditions) : null),
      IsHeld: row.isheld === true || row.isheld === 1 || row.IsHeld === true || row.IsHeld === 1,
      HoldReason: row.holdreason || row.HoldReason,
      CalculatedAt: row.calculatedat || row.CalculatedAt,
      CalculatedBy: row.calculatedby || row.CalculatedBy,
      PerDayRate: row.perdayrate !== null && row.perdayrate !== undefined ? parseFloat(row.perdayrate) : (row.PerDayRate !== null && row.PerDayRate !== undefined ? parseFloat(row.PerDayRate) : null),
      TotalWorkedHours: row.totalworkedhours !== null && row.totalworkedhours !== undefined ? parseFloat(row.totalworkedhours) : (row.TotalWorkedHours !== null && row.TotalWorkedHours !== undefined ? parseFloat(row.TotalWorkedHours) : null),
      OvertimeHours: row.overtimehours !== null && row.overtimehours !== undefined ? parseFloat(row.overtimehours) : (row.OvertimeHours !== null && row.OvertimeHours !== undefined ? parseFloat(row.OvertimeHours) : null),
      OvertimeAmount: row.overtimeamount !== null && row.overtimeamount !== undefined ? parseFloat(row.overtimeamount) : (row.OvertimeAmount !== null && row.OvertimeAmount !== undefined ? parseFloat(row.OvertimeAmount) : null),
      TdsDeduction: row.tdsdeduction !== null && row.tdsdeduction !== undefined ? parseFloat(row.tdsdeduction) : (row.TdsDeduction !== null && row.TdsDeduction !== undefined ? parseFloat(row.TdsDeduction) : null),
      ProfessionalTax: row.professionaltax !== null && row.professionaltax !== undefined ? parseFloat(row.professionaltax) : (row.ProfessionalTax !== null && row.ProfessionalTax !== undefined ? parseFloat(row.ProfessionalTax) : null),
      IncentiveAmount: row.incentiveamount !== null && row.incentiveamount !== undefined ? parseFloat(row.incentiveamount) : (row.IncentiveAmount !== null && row.IncentiveAmount !== undefined ? parseFloat(row.IncentiveAmount) : null),
      BreakdownJson: row.breakdownjson || row.BreakdownJson,
      Status: row.status !== null && row.status !== undefined ? (typeof row.status === 'number' ? row.status : parseInt(String(row.status))) : (row.Status !== null && row.Status !== undefined ? (typeof row.Status === 'number' ? row.Status : parseInt(String(row.Status))) : 0),
      };
      
      console.log('[MonthlySalaryModel] Successfully mapped salary:', {
        Id: mapped.Id,
        EmployeeCode: mapped.EmployeeCode,
        Month: mapped.Month,
        Status: mapped.Status,
      });
      
      return mapped;
    } catch (error) {
      const err = error as Error;
      console.error('[MonthlySalaryModel] Error mapping salary:', err.message);
      console.error('[MonthlySalaryModel] Row data:', JSON.stringify(row, null, 2));
      throw err;
    }
  }
}
