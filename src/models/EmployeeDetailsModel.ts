/**
 * EmployeeDetails Model
 * Database interactions for employee salary and HR data
 * 
 * REPLACES: Excel as the source of salary data
 * PURPOSE: Centralized database-driven employee details management
 * 
 * IMPORTANT BUSINESS RULE:
 * - EmployeeCode must match Employees.EmployeeCode
 * - Do NOT delete records; use ExitDate for inactive employees
 */

import sql from 'mssql';
import { query } from '../db/pool.js';
import { EmployeeDetails, CreateEmployeeDetailsRequest, UpdateEmployeeDetailsRequest } from '../types/index.js';
import { EmployeeModel } from './EmployeeModel.js';

export class EmployeeDetailsModel {
  /**
   * Get employee details by EmployeeCode
   * Returns null if not found
   */
  static async getByCode(employeeCode: string): Promise<EmployeeDetails | null> {
    try {
      const sqlQuery = `
        SELECT 
          EmployeeDetailsId,
          EmployeeCode,
          JoiningDate,
          ExitDate,
          BranchLocation,
          Department,
          Designation,
          BasicSalary,
          MonthlyCTC,
          AnnualCTC,
          Gender,
          PhoneNumber,
          Shift,
          BankAccNo,
          IFSCCode,
          CreatedAt,
          UpdatedAt,
          CreatedBy,
          UpdatedBy
        FROM dbo.EmployeeDetails
        WHERE EmployeeCode = @employeeCode
      `;

      const result = await query<any>(sqlQuery, { employeeCode });
      
      if (result.recordset.length === 0) {
        return null;
      }

      const row = result.recordset[0];
      return this.mapToEmployeeDetails(row);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error fetching employee details:', error.message);
      throw new Error(`Failed to fetch employee details: ${error.message}`);
    }
  }

  /**
   * Get all active employee details (ExitDate IS NULL)
   * If month is provided, also includes employees who exited in that month
   * Returns empty array if none found
   * @param month Optional month in YYYY-MM format to include exited employees from that month
   */
  static async getAllActive(month?: string): Promise<EmployeeDetails[]> {
    try {
      let sqlQuery = `
        SELECT 
          EmployeeDetailsId,
          EmployeeCode,
          JoiningDate,
          ExitDate,
          BranchLocation,
          Department,
          Designation,
          BasicSalary,
          MonthlyCTC,
          AnnualCTC,
          Gender,
          PhoneNumber,
          Shift,
          BankAccNo,
          IFSCCode,
          CreatedAt,
          UpdatedAt,
          CreatedBy,
          UpdatedBy
        FROM dbo.EmployeeDetails
        WHERE ExitDate IS NULL
      `;
      
      // If month is provided, also include employees who exited in that month
      // Salary cycle is 26th to 25th, so we need to check if exit date falls within that range
      const params: any = {};
      if (month) {
        // Validate month format (YYYY-MM)
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!monthRegex.test(month)) {
          throw new Error(`Invalid month format: ${month}. Expected YYYY-MM`);
        }
        
        // Parse month to get year and month number
        const [year, monthNum] = month.split('-').map(Number);
        
        // Calculate salary cycle: 26th of previous month to 25th of current month
        // For November 2025: Oct 26, 2025 to Nov 25, 2025
        const cycleStart = new Date(year, monthNum - 2, 26); // Previous month, 26th
        const cycleEnd = new Date(year, monthNum - 1, 25);   // Current month, 25th
        
        // Format dates for SQL (YYYY-MM-DD)
        const cycleStartStr = cycleStart.toISOString().split('T')[0];
        const cycleEndStr = cycleEnd.toISOString().split('T')[0];
        
        params.cycleStart = cycleStartStr;
        params.cycleEnd = cycleEndStr;
        
        sqlQuery += `
          OR (ExitDate IS NOT NULL 
              AND CONVERT(date, ExitDate) >= @cycleStart 
              AND CONVERT(date, ExitDate) <= @cycleEnd)
        `;
      }
      
      sqlQuery += ` ORDER BY BranchLocation ASC`;

      const result = await query<any>(sqlQuery, params);
      return result.recordset.map(row => this.mapToEmployeeDetails(row));
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error fetching all active employees:', error.message);
      throw new Error(`Failed to fetch active employees: ${error.message}`);
    }
  }

  /**
   * Get all employee details (including exited employees)
   */
  static async getAll(): Promise<EmployeeDetails[]> {
    try {
      const sqlQuery = `
        SELECT 
          EmployeeDetailsId,
          EmployeeCode,
          JoiningDate,
          ExitDate,
          BranchLocation,
          Department,
          Designation,
          BasicSalary,
          MonthlyCTC,
          AnnualCTC,
          Gender,
          PhoneNumber,
          Shift,
          BankAccNo,
          IFSCCode,
          CreatedAt,
          UpdatedAt,
          CreatedBy,
          UpdatedBy
        FROM dbo.EmployeeDetails
        ORDER BY EmployeeCode
      `;

      const result = await query<any>(sqlQuery);
      return result.recordset.map(row => this.mapToEmployeeDetails(row));
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error fetching all employees:', error.message);
      throw new Error(`Failed to fetch all employees: ${error.message}`);
    }
  }

  /**
   * Get employees by department
   */
  static async getByDepartment(department: string): Promise<EmployeeDetails[]> {
    try {
      const sqlQuery = `
        SELECT 
          EmployeeDetailsId,
          EmployeeCode,
          JoiningDate,
          ExitDate,
          BranchLocation,
          Department,
          Designation,
          BasicSalary,
          MonthlyCTC,
          AnnualCTC,
          Gender,
          PhoneNumber,
          Shift,
          BankAccNo,
          IFSCCode,
          CreatedAt,
          UpdatedAt,
          CreatedBy,
          UpdatedBy
        FROM dbo.EmployeeDetails
        WHERE Department = @department AND ExitDate IS NULL
        ORDER BY EmployeeCode
      `;

      const result = await query<any>(sqlQuery, { department });
      return result.recordset.map(row => this.mapToEmployeeDetails(row));
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error fetching by department:', error.message);
      throw new Error(`Failed to fetch employees by department: ${error.message}`);
    }
  }

  /**
   * Create new employee details
   * Validates that EmployeeCode exists in Employees table
   */
  static async create(data: CreateEmployeeDetailsRequest): Promise<EmployeeDetails> {
    try {
      // Validate that EmployeeCode exists in Employees table
      const employeeExists = await EmployeeModel.exists(data.employeeCode);
      if (!employeeExists) {
        throw new Error(`EmployeeCode ${data.employeeCode} does not exist in Employees table`);
      }

      // Check if details already exist
      const existingDetails = await this.getByCode(data.employeeCode);
      if (existingDetails) {
        throw new Error(`EmployeeCode ${data.employeeCode} already has details in EmployeeDetails table`);
      }

      const sqlQuery = `
        INSERT INTO dbo.EmployeeDetails (
          EmployeeCode,
          JoiningDate,
          BranchLocation,
          Department,
          Designation,
          BasicSalary,
          MonthlyCTC,
          AnnualCTC,
          Gender,
          PhoneNumber,
          Shift,
          BankAccNo,
          IFSCCode,
          CreatedBy
        )
        OUTPUT INSERTED.*
        VALUES (
          @employeeCode,
          @joiningDate,
          @branchLocation,
          @department,
          @designation,
          @basicSalary,
          @monthlyCTC,
          @annualCTC,
          @gender,
          @phoneNumber,
          @shift,
          @BankAccNo,
          @IFSCCode,
          @createdBy
        )
      `;

      const result = await query<any>(sqlQuery, {
        employeeCode: data.employeeCode,
        joiningDate: data.joiningDate || null,
        branchLocation: data.branchLocation || null,
        department: data.department || null,
        designation: data.designation || null,
        basicSalary: data.basicSalary,
        monthlyCTC: data.monthlyCTC || null,
        annualCTC: data.annualCTC || null,
        gender: data.gender || null,
        phoneNumber: data.phoneNumber || null,
        shift: data.shift || null,
        BankAccNo: data.BankAccNo || null,
        IFSCCode: data.IFSCCode || null,
        createdBy: data.createdBy || null,
      });

      console.log(`[EmployeeDetailsModel] ✅ Created details for employee ${data.employeeCode}`);
      return this.mapToEmployeeDetails(result.recordset[0]);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error creating employee details:', error.message);
      throw new Error(`Failed to create employee details: ${error.message}`);
    }
  }

  /**
   * Update employee details
   * Only updates fields that are provided in the request
   */
  static async update(employeeCode: string, data: UpdateEmployeeDetailsRequest): Promise<EmployeeDetails> {
    try {
      // Check if employee details exist
      const existingDetails = await this.getByCode(employeeCode);
      if (!existingDetails) {
        throw new Error(`EmployeeCode ${employeeCode} not found in EmployeeDetails table`);
      }

      // Build dynamic update query based on provided fields
      const updates: string[] = [];
      const params: any = { employeeCode };

      if (data.joiningDate !== undefined) {
        updates.push('JoiningDate = @joiningDate');
        params.joiningDate = data.joiningDate;
      }
      if (data.exitDate !== undefined) {
        updates.push('ExitDate = @exitDate');
        params.exitDate = data.exitDate;
      }
      if (data.branchLocation !== undefined) {
        updates.push('BranchLocation = @branchLocation');
        params.branchLocation = data.branchLocation;
      }
      if (data.department !== undefined) {
        updates.push('Department = @department');
        params.department = data.department;
      }
      if (data.designation !== undefined) {
        updates.push('Designation = @designation');
        params.designation = data.designation;
      }
      if (data.basicSalary !== undefined) {
        updates.push('BasicSalary = @basicSalary');
        params.basicSalary = data.basicSalary;
      }
      if (data.monthlyCTC !== undefined) {
        updates.push('MonthlyCTC = @monthlyCTC');
        params.monthlyCTC = data.monthlyCTC;
      }
      if (data.annualCTC !== undefined) {
        updates.push('AnnualCTC = @annualCTC');
        params.annualCTC = data.annualCTC;
      }
      if (data.gender !== undefined) {
        updates.push('Gender = @gender');
        params.gender = data.gender;
      }
      if (data.phoneNumber !== undefined) {
        updates.push('PhoneNumber = @phoneNumber');
        params.phoneNumber = data.phoneNumber;
      }
      if (data.shift !== undefined) {
        updates.push('Shift = @shift');
        params.shift = data.shift;
      }
      if (data.BankAccNo !== undefined) {
        updates.push('BankAccNo = @BankAccNo');
        params.BankAccNo = data.BankAccNo;
      }
      if (data.IFSCCode !== undefined) {
        updates.push('IFSCCode = @IFSCCode');
        params.IFSCCode = data.IFSCCode;
      }
      if (data.updatedBy !== undefined) {
        updates.push('UpdatedBy = @updatedBy');
        params.updatedBy = data.updatedBy;
      }

      // Always update UpdatedAt
      updates.push('UpdatedAt = GETDATE()');

      if (updates.length === 1) { // Only UpdatedAt, no real updates
        throw new Error('No fields provided to update');
      }

      const sqlQuery = `
        UPDATE dbo.EmployeeDetails
        SET ${updates.join(', ')}
        OUTPUT INSERTED.*
        WHERE EmployeeCode = @employeeCode
      `;

      const result = await query<any>(sqlQuery, params);
      
      console.log(`[EmployeeDetailsModel] ✅ Updated details for employee ${employeeCode}`);
      return this.mapToEmployeeDetails(result.recordset[0]);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error updating employee details:', error.message);
      throw new Error(`Failed to update employee details: ${error.message}`);
    }
  }

  /**
   * Mark employee as exited
   * Sets ExitDate instead of deleting the record
   */
  static async markAsExited(employeeCode: string, exitDate: string, updatedBy?: string): Promise<void> {
    try {
      await this.update(employeeCode, {
        exitDate,
        updatedBy,
      });
      console.log(`[EmployeeDetailsModel] ✅ Marked employee ${employeeCode} as exited on ${exitDate}`);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error marking employee as exited:', error.message);
      throw new Error(`Failed to mark employee as exited: ${error.message}`);
    }
  }

  /**
   * Check if employee details exist
   */
  static async exists(employeeCode: string): Promise<boolean> {
    try {
      const sqlQuery = `
        SELECT COUNT(*) as Count
        FROM dbo.EmployeeDetails
        WHERE EmployeeCode = @employeeCode
      `;

      const result = await query<{ Count: number }>(sqlQuery, { employeeCode });
      return result.recordset[0].Count > 0;
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error checking existence:', error.message);
      return false;
    }
  }

  /**
   * Get basic salary for salary calculation
   * Returns baseSalary and hourlyRate (hourlyRate should be calculated dynamically in payroll service based on actual shift hours)
   */
  static async getSalaryInfo(employeeCode: string): Promise<{ baseSalary: number; hourlyRate: number }> {
    try {
      const details = await this.getByCode(employeeCode);
      
      if (!details) {
        throw new Error(`Employee details not found for ${employeeCode}`);
      }

      // Return 0 for hourlyRate - it will be calculated dynamically in payroll service
      // based on the actual shift hours (9 hours, 8 hours, etc.) and cycle days
      // This ensures accuracy as different employees may have different shift hours
      return {
        baseSalary: details.BasicSalary,
        hourlyRate: 0, // Will be calculated dynamically based on actual shift hours
      };
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsModel] Error getting salary info:', error.message);
      throw new Error(`Failed to get salary info: ${error.message}`);
    }
  }

  /**
   * Helper: Map database row to EmployeeDetails interface
   */
  private static mapToEmployeeDetails(row: any): EmployeeDetails {
    return {
      EmployeeDetailsId: row.EmployeeDetailsId,
      EmployeeCode: row.EmployeeCode,
      JoiningDate: row.JoiningDate ? this.formatDate(row.JoiningDate) : null,
      ExitDate: row.ExitDate ? this.formatDate(row.ExitDate) : null,
      BranchLocation: row.BranchLocation,
      Department: row.Department,
      Designation: row.Designation,
      BasicSalary: parseFloat(row.BasicSalary),
      MonthlyCTC: row.MonthlyCTC ? parseFloat(row.MonthlyCTC) : null,
      AnnualCTC: row.AnnualCTC ? parseFloat(row.AnnualCTC) : null,
      Gender: row.Gender,
      PhoneNumber: row.PhoneNumber,
      Shift: row.Shift || null,
      BankAccNo: row.BankAccNo || null,
      IFSCCode: row.IFSCCode || row.IFSCcode || null,
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
      CreatedBy: row.CreatedBy,
      UpdatedBy: row.UpdatedBy,
    };
  }

  /**
   * Helper: Format date as YYYY-MM-DD
   */
  private static formatDate(date: Date | string): string {
    if (typeof date === 'string') return date;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }
}

export default EmployeeDetailsModel;

