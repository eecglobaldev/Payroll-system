/**
 * Employee Model
 * Database interactions for employee data
 */

import { query } from '../db/pool.js';
import { Employee, BaseSalaryInfo } from '../types/index.js';

export class EmployeeModel {
  /**
   * Get employee by code
   */
  static async getByCode(employeeCode: string): Promise<Employee | null> {
    const sqlQuery = `
      SELECT 
        EmployeeId,
        EmployeeCode,
        EmployeeName,
        StringCode,
        NumericCode,
        Gender,
        CompanyId,
        DepartmentId,
        Designation,
        CategoryId
      FROM dbo.Employees
      WHERE EmployeeCode = @employeeCode
    `;

    const result = await query<Employee>(sqlQuery, { employeeCode });
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Get employee salary information
   */
  static async getSalaryInfo(employeeCode: string): Promise<BaseSalaryInfo> {
    try {
      const sqlQuery = `
        SELECT BaseSalary, HourlyRate
        FROM dbo.Employees
        WHERE EmployeeCode = @employeeCode
      `;

      const result = await query<{ BaseSalary: number; HourlyRate: number | null }>(
        sqlQuery,
        { employeeCode }
      );

      if (result.recordset.length > 0) {
        return {
          baseSalary: result.recordset[0].BaseSalary || 50000,
          hourlyRate: result.recordset[0].HourlyRate || null,
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
    const sqlQuery = `
      SELECT 
        EmployeeId,
        EmployeeCode,
        EmployeeName,
        StringCode,
        NumericCode,
        Gender,
        CompanyId,
        DepartmentId,
        Designation,
        CategoryId
      FROM dbo.Employees
      ORDER BY EmployeeCode
    `;

    const result = await query<Employee>(sqlQuery);
    return result.recordset;
  }

  /**
   * Get employees by department
   */
  static async getByDepartment(department: string): Promise<Employee[]> {
    const sqlQuery = `
      SELECT 
        EmployeeId,
        EmployeeCode,
        EmployeeName,
        StringCode,
        NumericCode,
        Gender,
        CompanyId,
        DepartmentId,
        Designation,
        CategoryId
      FROM dbo.Employees
      WHERE DepartmentId = @department
      ORDER BY EmployeeCode
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
      FROM dbo.Employees
      WHERE EmployeeCode = @employeeCode
    `;

    const result = await query<{ Count: number }>(sqlQuery, { employeeCode });
    return result.recordset[0].Count > 0;
  }

  /**
   * Create a new employee
   */
  static async create(employee: Omit<Employee, 'CreatedAt' | 'UpdatedAt'>): Promise<void> {
    const sqlQuery = `
      INSERT INTO dbo.Employees 
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
      UPDATE dbo.Employees
      SET ${fields}, UpdatedAt = GETDATE()
      WHERE EmployeeCode = @employeeCode
    `;

    await query(sqlQuery, { employeeCode, ...updates });
  }

  /**
   * Deactivate employee
   */
  static async deactivate(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE dbo.Employees
      SET IsActive = 0, UpdatedAt = GETDATE()
      WHERE EmployeeCode = @employeeCode
    `;

    await query(sqlQuery, { employeeCode });
  }
}

export default EmployeeModel;

