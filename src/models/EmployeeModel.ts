/**
 * Employee Model
 * Database interactions for employee data
 */

import { query } from '../db/pool.js';
import { Employee, BaseSalaryInfo } from '../types/index.js';

export class EmployeeModel {
  /**
   * Map database row to Employee interface
   * Handles both lowercase (PostgreSQL default) and PascalCase column names
   */
  private static mapToEmployee(row: any): Employee {
    // PostgreSQL returns lowercase column names by default
    // Try all possible case variations
    const employeeId = row.employeeid ?? row.EmployeeId ?? row.employeeId ?? row.EMPLOYEEID ?? null;
    const employeeCode = row.employeecode ?? row.EmployeeCode ?? row.employeeCode ?? row.EMPLOYEECODE ?? null;
    const employeeName = row.employeename ?? row.EmployeeName ?? row.employeeName ?? row.EMPLOYEENAME ?? 'Unknown';
    
    return {
      EmployeeId: employeeId,
      EmployeeCode: employeeCode,
      EmployeeName: employeeName,
      StringCode: row.stringcode ?? row.StringCode ?? row.stringCode ?? row.STRINGCODE ?? null,
      NumericCode: row.numericcode ?? row.NumericCode ?? row.numericCode ?? row.NUMERICCODE ?? null,
      Gender: row.gender ?? row.Gender ?? row.GENDER ?? null,
      CompanyId: row.companyid ?? row.CompanyId ?? row.companyId ?? row.COMPANYID ?? null,
      DepartmentId: row.departmentid ?? row.DepartmentId ?? row.departmentId ?? row.DEPARTMENTID ?? null,
      Designation: row.designation ?? row.Designation ?? row.DESIGNATION ?? null,
      CategoryId: row.categoryid ?? row.CategoryId ?? row.categoryId ?? row.CATEGORYID ?? null,
    };
  }

  /**
   * Get employee by code
   */
  static async getByCode(employeeCode: string): Promise<Employee | null> {
    const sqlQuery = `
      SELECT 
        employeeid,
        employeecode,
        employeename,
        stringcode,
        numericcode,
        gender,
        companyid,
        departmentid,
        designation,
        categoryid
      FROM employees
      WHERE employeecode = @employeeCode
    `;

    const result = await query<any>(sqlQuery, { employeeCode });
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Map database row to Employee interface
    return this.mapToEmployee(result.recordset[0]);
  }

  /**
   * Get employee by ID
   */
  static async getById(employeeId: number): Promise<Employee | null> {
    const sqlQuery = `
      SELECT 
        employeeid,
        employeecode,
        employeename,
        stringcode,
        numericcode,
        gender,
        companyid,
        departmentid,
        designation,
        categoryid
      FROM employees
      WHERE employeeid = @employeeId
    `;

    const result = await query<any>(sqlQuery, { employeeId });
    if (result.recordset.length === 0) {
      return null;
    }
    
    // Map database row to Employee interface
    return this.mapToEmployee(result.recordset[0]);
  }

  /**
   * Get employee salary information
   */
  static async getSalaryInfo(employeeCode: string): Promise<BaseSalaryInfo> {
    try {
      const sqlQuery = `
        SELECT basesalary, hourlyrate
        FROM employees
        WHERE employeecode = @employeeCode
      `;

      const result = await query<{ BaseSalary: number; HourlyRate: number | null }>(
        sqlQuery,
        { employeeCode }
      );

      if (result.recordset.length > 0) {
        const row: any = result.recordset[0];
        return {
          baseSalary: row.basesalary || row.BaseSalary || 50000,
          hourlyRate: row.hourlyrate || row.HourlyRate || null,
        };
      }
    } catch (err) {
      const error = err as Error;
      console.warn('[EmployeeModel] Could not fetch salary from DB:', error.message);
    }

    // Default fallback
    return {
      baseSalary: 50000,
      hourlyRate: null,
    };
  }

  /**
   * Get all employees (IsActive column doesn't exist in actual table)
   */
  static async getAllActive(): Promise<Employee[]> {
    // Use quoted identifiers to ensure case sensitivity
    const sqlQuery = `
      SELECT 
        "employeeid",
        "employeecode",
        "employeename",
        "stringcode",
        "numericcode",
        "gender",
        "companyid",
        "departmentid",
        "designation",
        "categoryid"
      FROM employees
      ORDER BY "employeecode"
    `;

    const result = await query<any>(sqlQuery);
    
    // Debug: Log first row to see what we're getting
    if (result.recordset.length > 0) {
      const firstRow = result.recordset[0];
      console.log('[EmployeeModel] Sample row keys:', Object.keys(firstRow));
      console.log('[EmployeeModel] Sample row (first 500 chars):', JSON.stringify(firstRow, null, 2).substring(0, 500));
      console.log('[EmployeeModel] employeeid value:', firstRow.employeeid, firstRow.EmployeeId, firstRow.EMPLOYEEID);
      console.log('[EmployeeModel] employeecode value:', firstRow.employeecode, firstRow.EmployeeCode, firstRow.EMPLOYEECODE);
    }
    
    // Map each row using mapToEmployee
    const mapped = result.recordset.map(row => this.mapToEmployee(row));
    console.log(`[EmployeeModel] Mapped ${mapped.length} employees. First employee:`, {
      EmployeeId: mapped[0]?.EmployeeId,
      EmployeeCode: mapped[0]?.EmployeeCode,
      EmployeeName: mapped[0]?.EmployeeName
    });
    return mapped;
  }

  /**
   * Get employees by department
   */
  static async getByDepartment(department: string): Promise<Employee[]> {
    const sqlQuery = `
      SELECT 
        employeeid,
        employeecode,
        employeename,
        stringcode,
        numericcode,
        gender,
        companyid,
        departmentid,
        designation,
        categoryid
      FROM employees
      WHERE departmentid = @department
      ORDER BY employeecode
    `;

    const result = await query<Employee>(sqlQuery, { department });
    return result.recordset;
  }

  /**
   * Check if employee exists
   */
  static async exists(employeeCode: string): Promise<boolean> {
    const sqlQuery = `
      SELECT COUNT(*) as Count
      FROM employees
      WHERE employeecode = @employeeCode
    `;

    const result = await query<{ Count: number }>(sqlQuery, { employeeCode });
    const row: any = result.recordset[0];
    return (row.count || row.Count || 0) > 0;
  }

  /**
   * Create a new employee
   */
  static async create(employee: Omit<Employee, 'CreatedAt' | 'UpdatedAt'>): Promise<void> {
    const sqlQuery = `
      INSERT INTO employees 
        (EmployeeCode, FullName, Department, Designation, BaseSalary, HourlyRate, JoinDate, IsActive, Email, PhoneNumber)
      VALUES 
        (@EmployeeCode, @FullName, @Department, @Designation, @BaseSalary, @HourlyRate, @JoinDate, @IsActive, @Email, @PhoneNumber)
    `;

    await query(sqlQuery, employee);
  }

  /**
   * Update employee information
   */
  static async update(employeeCode: string, updates: Partial<Employee>): Promise<void> {
    const fields = Object.keys(updates)
      .filter(key => key !== 'EmployeeCode')
      .map(key => `${key} = @${key}`)
      .join(', ');

    const sqlQuery = `
      UPDATE employees
      SET ${fields}, updatedat = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    await query(sqlQuery, { employeeCode, ...updates });
  }

  /**
   * Deactivate employee
   */
  static async deactivate(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE employees
      SET isactive = 0, updatedat = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    await query(sqlQuery, { employeeCode });
  }
}

export default EmployeeModel;

