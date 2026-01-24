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

    const result = await query<Employee>(sqlQuery, { employeeCode });
    return result.recordset.length > 0 ? result.recordset[0] : null;
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
      ORDER BY employeecode
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

