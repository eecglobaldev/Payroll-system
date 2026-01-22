/**
 * Employee Details Service
 * Business logic for employee HR and salary data management
 * 
 * REPLACES: Excel-based employee data
 * PURPOSE: Centralized service for employee details operations
 */

import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { 
  EmployeeDetails, 
  CreateEmployeeDetailsRequest, 
  UpdateEmployeeDetailsRequest,
  EmployeeWithDetails 
} from '../types/index.js';

export class EmployeeDetailsService {
  /**
   * Get employee with combined data from Employees and EmployeeDetails tables
   * Returns employee name from Employees table + all details from EmployeeDetails
   */
  static async getEmployeeWithDetails(employeeCode: string): Promise<EmployeeWithDetails | null> {
    try {
      // Fetch from both tables
      const [employee, details] = await Promise.all([
        EmployeeModel.getByCode(employeeCode),
        EmployeeDetailsModel.getByCode(employeeCode),
      ]);

      if (!employee) {
        console.warn(`[EmployeeDetailsService] Employee ${employeeCode} not found in Employees table`);
        return null;
      }

      if (!details) {
        console.warn(`[EmployeeDetailsService] Employee ${employeeCode} not found in EmployeeDetails table`);
        return null;
      }

      // Combine data
      return {
        employeeNo: employee.EmployeeCode,
        name: employee.EmployeeName, // From Employees table
        department: details.Department,
        designation: details.Designation,
        basicSalary: details.BasicSalary,
        monthlyCTC: details.MonthlyCTC,
        annualCTC: details.AnnualCTC,
        joiningDate: details.JoiningDate,
        exitDate: details.ExitDate,
        branchLocation: details.BranchLocation,
        gender: details.Gender,
        phoneNumber: details.PhoneNumber,
        shift: details.Shift || null, // Shift name
        bankAccNo: details.BankAccNo || null,
        ifscCode: details.IFSCCode || null,
        isActive: details.ExitDate === null,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error getting employee with details:', error.message);
      throw new Error(`Failed to get employee details: ${error.message}`);
    }
  }

  /**
   * Get all active employees with combined data
   */
  static async getAllActiveEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
    try {
      // Fetch from both tables
      const [dbEmployees, allDetails] = await Promise.all([
        EmployeeModel.getAllActive(),
        EmployeeDetailsModel.getAllActive(),
      ]);

      // Create a map of details by EmployeeCode for quick lookup
      const detailsMap = new Map<string, EmployeeDetails>();
      allDetails.forEach(detail => {
        detailsMap.set(detail.EmployeeCode, detail);
      });

      // Merge data
      const employees: EmployeeWithDetails[] = [];
      
      for (const dbEmp of dbEmployees) {
        const details = detailsMap.get(dbEmp.EmployeeCode);
        
        if (details) {
          employees.push({
            employeeNo: dbEmp.EmployeeCode,
            name: dbEmp.EmployeeName, // From Employees table
            department: details.Department,
            designation: details.Designation,
            basicSalary: details.BasicSalary,
            monthlyCTC: details.MonthlyCTC,
            annualCTC: details.AnnualCTC,
            joiningDate: details.JoiningDate,
            exitDate: details.ExitDate,
            branchLocation: details.BranchLocation,
            gender: details.Gender,
            phoneNumber: details.PhoneNumber,
            bankAccNo: details.BankAccNo || null,
            ifscCode: details.IFSCCode || null,
            isActive: details.ExitDate === null,
          });
        } else {
          // Employee exists in Employees table but not in EmployeeDetails
          console.warn(`[EmployeeDetailsService] Employee ${dbEmp.EmployeeCode} has no details in EmployeeDetails table`);
        }
      }

      console.log(`[EmployeeDetailsService] ✅ Loaded ${employees.length} employees with details`);
      return employees;
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error getting all employees:', error.message);
      throw new Error(`Failed to get all employees: ${error.message}`);
    }
  }

  /**
   * Get employees by department with combined data
   */
  static async getEmployeesByDepartment(department: string): Promise<EmployeeWithDetails[]> {
    try {
      // Get details from EmployeeDetails table filtered by department
      const details = await EmployeeDetailsModel.getByDepartment(department);

      // Fetch employee names from Employees table
      const employees: EmployeeWithDetails[] = [];
      
      for (const detail of details) {
        const employee = await EmployeeModel.getByCode(detail.EmployeeCode);
        
        if (employee) {
          employees.push({
            employeeNo: employee.EmployeeCode,
            name: employee.EmployeeName, // From Employees table
            department: detail.Department,
            designation: detail.Designation,
            basicSalary: detail.BasicSalary,
            monthlyCTC: detail.MonthlyCTC,
            annualCTC: detail.AnnualCTC,
            joiningDate: detail.JoiningDate,
            exitDate: detail.ExitDate,
            branchLocation: detail.BranchLocation,
            gender: detail.Gender,
            phoneNumber: detail.PhoneNumber,
            bankAccNo: detail.BankAccNo || null,
            ifscCode: detail.IFSCCode || null,
            isActive: detail.ExitDate === null,
          });
        }
      }

      return employees;
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error getting employees by department:', error.message);
      throw new Error(`Failed to get employees by department: ${error.message}`);
    }
  }

  /**
   * Create new employee details
   * Validates that EmployeeCode exists in Employees table
   */
  static async createEmployeeDetails(data: CreateEmployeeDetailsRequest): Promise<EmployeeDetails> {
    try {
      // Validate required fields
      if (!data.employeeCode) {
        throw new Error('EmployeeCode is required');
      }

      if (data.basicSalary === undefined || data.basicSalary < 0) {
        throw new Error('BasicSalary is required and must be >= 0');
      }

      // Create employee details
      const details = await EmployeeDetailsModel.create(data);
      console.log(`[EmployeeDetailsService] ✅ Created details for employee ${data.employeeCode}`);
      
      return details;
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error creating employee details:', error.message);
      throw new Error(`Failed to create employee details: ${error.message}`);
    }
  }

  /**
   * Update employee details
   */
  static async updateEmployeeDetails(
    employeeCode: string, 
    data: UpdateEmployeeDetailsRequest
  ): Promise<EmployeeDetails> {
    try {
      // Validate basicSalary if provided
      if (data.basicSalary !== undefined && data.basicSalary < 0) {
        throw new Error('BasicSalary must be >= 0');
      }

      // Update employee details
      const details = await EmployeeDetailsModel.update(employeeCode, data);
      console.log(`[EmployeeDetailsService] ✅ Updated details for employee ${employeeCode}`);
      
      return details;
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error updating employee details:', error.message);
      throw new Error(`Failed to update employee details: ${error.message}`);
    }
  }

  /**
   * Mark employee as exited
   */
  static async markEmployeeAsExited(
    employeeCode: string, 
    exitDate: string, 
    updatedBy?: string
  ): Promise<void> {
    try {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(exitDate)) {
        throw new Error('ExitDate must be in YYYY-MM-DD format');
      }

      await EmployeeDetailsModel.markAsExited(employeeCode, exitDate, updatedBy);
      console.log(`[EmployeeDetailsService] ✅ Marked employee ${employeeCode} as exited`);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error marking employee as exited:', error.message);
      throw new Error(`Failed to mark employee as exited: ${error.message}`);
    }
  }

  /**
   * Get salary info for salary calculation
   * Used by payroll service
   */
  static async getSalaryInfo(employeeCode: string): Promise<{ baseSalary: number; hourlyRate: number }> {
    try {
      return await EmployeeDetailsModel.getSalaryInfo(employeeCode);
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsService] Error getting salary info:', error.message);
      throw new Error(`Failed to get salary info: ${error.message}`);
    }
  }

  /**
   * Validate employee details data
   */
  static validateEmployeeDetailsData(data: CreateEmployeeDetailsRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!data.employeeCode || data.employeeCode.trim() === '') {
      errors.push('EmployeeCode is required');
    }

    if (data.basicSalary === undefined || data.basicSalary === null) {
      errors.push('BasicSalary is required');
    } else if (data.basicSalary < 0) {
      errors.push('BasicSalary must be >= 0');
    }

    // Optional field validations
    if (data.monthlyCTC !== undefined && data.monthlyCTC !== null && data.monthlyCTC < 0) {
      errors.push('MonthlyCTC must be >= 0');
    }

    if (data.annualCTC !== undefined && data.annualCTC !== null && data.annualCTC < 0) {
      errors.push('AnnualCTC must be >= 0');
    }

    // Date format validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (data.joiningDate && !dateRegex.test(data.joiningDate)) {
      errors.push('JoiningDate must be in YYYY-MM-DD format');
    }

    // Phone number validation (basic)
    if (data.phoneNumber && data.phoneNumber.length > 20) {
      errors.push('PhoneNumber must be <= 20 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default EmployeeDetailsService;

