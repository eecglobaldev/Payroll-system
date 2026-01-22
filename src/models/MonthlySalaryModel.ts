/**
 * MonthlySalary Model
 * Database operations for monthly salary snapshots
 * 
 * This table stores calculated salary as a single source of truth.
 * Admin portal calculates and saves here, employee portal only reads.
 */

import sql from 'mssql';
import { getPool } from '../db/pool.js';

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
   * Uses MERGE (UPSERT) to handle both insert and update
   */
  static async upsertSalary(
    data: CreateMonthlySalaryRequest
  ): Promise<MonthlySalary> {
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), data.employeeCode)
      .input('Month', sql.NVarChar(7), data.month)
      .input('GrossSalary', sql.Decimal(10, 2), data.grossSalary)
      .input('NetSalary', sql.Decimal(10, 2), data.netSalary)
      .input('BaseSalary', sql.Decimal(10, 2), data.baseSalary)
      .input('PaidDays', sql.Decimal(4, 2), data.paidDays)
      .input('AbsentDays', sql.Decimal(4, 2), data.absentDays)
      .input('LeaveDays', sql.Decimal(4, 2), data.leaveDays)
      .input('TotalDeductions', sql.Decimal(10, 2), data.totalDeductions)
      .input('TotalAdditions', sql.Decimal(10, 2), data.totalAdditions)
      .input('IsHeld', sql.Bit, data.isHeld ? 1 : 0)
      .input('HoldReason', sql.NVarChar(255), data.holdReason || null)
      .input('CalculatedBy', sql.NVarChar(50), data.calculatedBy || null)
      .input('PerDayRate', sql.Decimal(10, 2), data.perDayRate || null)
      .input('TotalWorkedHours', sql.Decimal(10, 2), data.totalWorkedHours || null)
      .input('OvertimeHours', sql.Decimal(10, 2), data.overtimeHours || null)
      .input('OvertimeAmount', sql.Decimal(10, 2), data.overtimeAmount || null)
      .input('TdsDeduction', sql.Decimal(10, 2), data.tdsDeduction || null)
      .input('ProfessionalTax', sql.Decimal(10, 2), data.professionalTax || null)
      .input('IncentiveAmount', sql.Decimal(10, 2), data.incentiveAmount || null)
      .input('BreakdownJson', sql.NVarChar(sql.MAX), data.breakdownJson || null)
      .input('Status', sql.TinyInt, data.status !== undefined ? data.status : 0) // Default to 0 (DRAFT)
      .query<MonthlySalary>(`
        MERGE dbo.MonthlySalary AS target
        USING (SELECT @EmployeeCode AS EmployeeCode, @Month AS Month) AS source
        ON target.EmployeeCode = source.EmployeeCode AND target.Month = source.Month
        WHEN MATCHED THEN
          UPDATE SET
            GrossSalary = @GrossSalary,
            NetSalary = @NetSalary,
            BaseSalary = @BaseSalary,
            PaidDays = @PaidDays,
            AbsentDays = @AbsentDays,
            LeaveDays = @LeaveDays,
            TotalDeductions = @TotalDeductions,
            TotalAdditions = @TotalAdditions,
            IsHeld = @IsHeld,
            HoldReason = @HoldReason,
            CalculatedAt = GETDATE(),
            CalculatedBy = @CalculatedBy,
            Status = @Status,
            PerDayRate = @PerDayRate,
            TotalWorkedHours = @TotalWorkedHours,
            OvertimeHours = @OvertimeHours,
            OvertimeAmount = @OvertimeAmount,
            TdsDeduction = @TdsDeduction,
            ProfessionalTax = @ProfessionalTax,
            IncentiveAmount = @IncentiveAmount,
            BreakdownJson = @BreakdownJson
        WHEN NOT MATCHED THEN
          INSERT (
            EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
            PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
            IsHeld, HoldReason, CalculatedBy, Status,
            PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
            TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
          )
          VALUES (
            @EmployeeCode, @Month, @GrossSalary, @NetSalary, @BaseSalary,
            @PaidDays, @AbsentDays, @LeaveDays, @TotalDeductions, @TotalAdditions,
            @IsHeld, @HoldReason, @CalculatedBy, @Status,
            @PerDayRate, @TotalWorkedHours, @OvertimeHours, @OvertimeAmount,
            @TdsDeduction, @ProfessionalTax, @IncentiveAmount, @BreakdownJson
          );
        
        SELECT 
          Id, EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
          PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
          IsHeld, HoldReason, CalculatedAt, CalculatedBy, Status,
          PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
          TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
        FROM dbo.MonthlySalary
        WHERE EmployeeCode = @EmployeeCode AND Month = @Month
      `);

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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const statusFilter = finalizedOnly ? 'AND Status = 1' : '';

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .query<MonthlySalary>(`
        SELECT 
          Id, EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
          PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
          IsHeld, HoldReason, CalculatedAt, CalculatedBy, Status,
          PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
          TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
        FROM dbo.MonthlySalary
        WHERE EmployeeCode = @EmployeeCode AND Month = @Month ${statusFilter}
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToMonthlySalary(result.recordset[0]);
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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const statusFilter = finalizedOnly ? 'AND Status = 1' : '';

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .query<MonthlySalary>(`
        SELECT TOP 1
          Id, EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
          PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
          IsHeld, HoldReason, CalculatedAt, CalculatedBy, Status,
          PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
          TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
        FROM dbo.MonthlySalary
        WHERE EmployeeCode = @EmployeeCode ${statusFilter}
        ORDER BY Month DESC
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToMonthlySalary(result.recordset[0]);
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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const statusFilter = finalizedOnly ? 'AND Status = 1' : '';

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Limit', sql.Int, limit)
      .query<MonthlySalary>(`
        SELECT TOP (@Limit)
          Id, EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
          PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
          IsHeld, HoldReason, CalculatedAt, CalculatedBy, Status,
          PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
          TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
        FROM dbo.MonthlySalary
        WHERE EmployeeCode = @EmployeeCode ${statusFilter}
        ORDER BY Month DESC
      `);

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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('EmployeeCode', sql.NVarChar(50), employeeCode)
      .input('Month', sql.NVarChar(7), month)
      .input('CalculatedBy', sql.NVarChar(50), calculatedBy)
      .query<MonthlySalary>(`
        UPDATE dbo.MonthlySalary
        SET Status = 1,
            CalculatedAt = GETDATE(),
            CalculatedBy = @CalculatedBy
        WHERE EmployeeCode = @EmployeeCode 
          AND Month = @Month 
          AND Status = 0;
        
        SELECT 
          Id, EmployeeCode, Month, GrossSalary, NetSalary, BaseSalary,
          PaidDays, AbsentDays, LeaveDays, TotalDeductions, TotalAdditions,
          IsHeld, HoldReason, CalculatedAt, CalculatedBy, Status,
          PerDayRate, TotalWorkedHours, OvertimeHours, OvertimeAmount,
          TdsDeduction, ProfessionalTax, IncentiveAmount, BreakdownJson
        FROM dbo.MonthlySalary
        WHERE EmployeeCode = @EmployeeCode AND Month = @Month
      `);

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
    const pool = await getPool();
    if (!pool) throw new Error('Database pool not available');

    const result = await pool
      .request()
      .input('Month', sql.NVarChar(7), month)
      .input('CalculatedBy', sql.NVarChar(50), calculatedBy)
      .query<{ rowsAffected: number }>(`
        UPDATE dbo.MonthlySalary
        SET Status = 1,
            CalculatedAt = GETDATE(),
            CalculatedBy = @CalculatedBy
        WHERE Month = @Month 
          AND Status = 0;
        
        SELECT @@ROWCOUNT AS rowsAffected;
      `);

    const rowsAffected = result.recordset[0]?.rowsAffected || 0;
    return { updated: rowsAffected };
  }

  /**
   * Map database row to MonthlySalary interface
   */
  private static mapToMonthlySalary(row: any): MonthlySalary {
    return {
      Id: row.Id,
      EmployeeCode: row.EmployeeCode,
      Month: row.Month,
      GrossSalary: row.GrossSalary !== null ? parseFloat(row.GrossSalary) : null,
      NetSalary: row.NetSalary !== null ? parseFloat(row.NetSalary) : null,
      BaseSalary: row.BaseSalary !== null ? parseFloat(row.BaseSalary) : null,
      PaidDays: row.PaidDays !== null ? parseFloat(row.PaidDays) : null,
      AbsentDays: row.AbsentDays !== null ? parseFloat(row.AbsentDays) : null,
      LeaveDays: row.LeaveDays !== null ? parseFloat(row.LeaveDays) : null,
      TotalDeductions: row.TotalDeductions !== null ? parseFloat(row.TotalDeductions) : null,
      TotalAdditions: row.TotalAdditions !== null ? parseFloat(row.TotalAdditions) : null,
      IsHeld: row.IsHeld === true || row.IsHeld === 1,
      HoldReason: row.HoldReason,
      CalculatedAt: row.CalculatedAt,
      CalculatedBy: row.CalculatedBy,
      PerDayRate: row.PerDayRate !== null ? parseFloat(row.PerDayRate) : null,
      TotalWorkedHours: row.TotalWorkedHours !== null ? parseFloat(row.TotalWorkedHours) : null,
      OvertimeHours: row.OvertimeHours !== null ? parseFloat(row.OvertimeHours) : null,
      OvertimeAmount: row.OvertimeAmount !== null ? parseFloat(row.OvertimeAmount) : null,
      TdsDeduction: row.TdsDeduction !== null ? parseFloat(row.TdsDeduction) : null,
      ProfessionalTax: row.ProfessionalTax !== null ? parseFloat(row.ProfessionalTax) : null,
      IncentiveAmount: row.IncentiveAmount !== null ? parseFloat(row.IncentiveAmount) : null,
      BreakdownJson: row.BreakdownJson,
      Status: row.Status !== null && row.Status !== undefined ? parseInt(row.Status) : 0,
    };
  }
}

