/**
 * Employee Shift Assignment Model
 * Database interactions for date-wise shift assignments
 * 
 * PURPOSE: Support multiple shifts per employee within a month
 * - Week-wise shift changes
 * - Single-day shift changes
 * - Combination of normal and split shifts
 * 
 * IMPORTANT: Shift assignments take precedence over EmployeeDetails.Shift
 * If no assignment exists for a date, system falls back to EmployeeDetails.Shift
 */

import { query } from '../db/pool.js';
import { EmployeeShiftAssignment, CreateShiftAssignmentRequest } from '../types/index.js';

export class EmployeeShiftAssignmentModel {
  /**
   * Get all shift assignments for an employee within a date range
   * Returns assignments that overlap with the given date range
   * @param employeeCode Employee code
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns Array of shift assignments, ordered by FromDate (ascending), then CreatedAt (descending)
   */
  static async getAssignmentsForEmployee(
    employeeCode: string,
    startDate: string,
    endDate: string
  ): Promise<EmployeeShiftAssignment[]> {
    try {
      const sqlQuery = `
        SELECT
          id,
          employeecode,
          shiftname,
          fromdate,
          todate,
          createdat
        FROM employee_shift_assignments
        WHERE employeecode = @employeeCode
          AND (
            -- Assignment starts within range
            (fromdate >= @startDate AND fromdate <= @endDate)
            -- Assignment ends within range
            OR (todate >= @startDate AND todate <= @endDate)
            -- Assignment completely covers range
            OR (fromdate <= @startDate AND todate >= @endDate)
          )
        ORDER BY fromdate ASC, createdat DESC
      `;

      const result = await query<any>(sqlQuery, {
        employeeCode,
        startDate,
        endDate,
      });

      return result.recordset.map((row: any) => this.mapToShiftAssignment(row));
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentModel] Error fetching assignments:', error.message);
      throw new Error(`Failed to fetch shift assignments: ${error.message}`);
    }
  }

  /**
   * Get shift assignment for a specific date
   * Returns the most recent assignment that covers the given date
   * If multiple assignments overlap, the one with latest CreatedAt takes precedence
   * @param assignments Array of shift assignments (from getAssignmentsForEmployee)
   * @param date Date in YYYY-MM-DD format
   * @returns Shift name or null if no assignment covers the date
   */
  static getShiftForDate(
    assignments: EmployeeShiftAssignment[],
    date: string
  ): string | null {
    if (!assignments || assignments.length === 0) {
      return null;
    }

    // Filter assignments that cover the given date
    const coveringAssignments = assignments.filter(
      (assignment) => date >= assignment.FromDate && date <= assignment.ToDate
    );

    if (coveringAssignments.length === 0) {
      return null;
    }

    // If multiple assignments cover the date, use the one with latest CreatedAt
    // Sort by CreatedAt descending and take the first one
    const sorted = coveringAssignments.sort((a, b) => {
      const aTime = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
      const bTime = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
      return bTime - aTime; // Descending order
    });

    return sorted[0].ShiftName;
  }

  /**
   * Create a new shift assignment
   * @param request Shift assignment request
   * @returns Created shift assignment
   */
  static async createAssignment(
    request: CreateShiftAssignmentRequest
  ): Promise<EmployeeShiftAssignment> {
    try {
      // Validate date range
      if (request.fromDate > request.toDate) {
        throw new Error('FromDate must be less than or equal to ToDate');
      }

      const sqlQuery = `
        INSERT INTO employee_shift_assignments (
          employeecode,
          shiftname,
          fromdate,
          todate
        )
        VALUES (
          @employeeCode,
          @shiftName,
          @fromDate,
          @toDate
        )
        RETURNING id;
      `;

      const result = await query<any>(sqlQuery, {
        employeeCode: request.employeeCode,
        shiftName: request.shiftName,
        fromDate: request.fromDate,
        toDate: request.toDate,
      });

      const newId = result.recordset[0].Id;

      // Fetch the created assignment
      const created = await this.getById(newId);
      if (!created) {
        throw new Error('Failed to retrieve created assignment');
      }

      return created;
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentModel] Error creating assignment:', error.message);
      throw new Error(`Failed to create shift assignment: ${error.message}`);
    }
  }

  /**
   * Get shift assignment by ID
   * @param id Assignment ID
   * @returns Shift assignment or null if not found
   */
  static async getById(id: number): Promise<EmployeeShiftAssignment | null> {
    try {
      const sqlQuery = `
        SELECT
          Id,
          EmployeeCode,
          ShiftName,
          FromDate,
          ToDate,
          CreatedAt
        FROM employee_shift_assignments
        WHERE Id = @id
      `;

      const result = await query<any>(sqlQuery, { id });

      if (result.recordset.length === 0) {
        return null;
      }

      return this.mapToShiftAssignment(result.recordset[0]);
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentModel] Error fetching assignment by ID:', error.message);
      throw new Error(`Failed to fetch shift assignment: ${error.message}`);
    }
  }

  /**
   * Delete shift assignment by ID
   * @param id Assignment ID
   * @returns true if deleted, false if not found
   */
  static async deleteById(id: number): Promise<boolean> {
    try {
      const sqlQuery = `
        DELETE FROM dbo.Employee_Shift_Assignments
        WHERE Id = @id
      `;

      const result = await query<any>(sqlQuery, { id });

      return result.rowsAffected[0] > 0;
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentModel] Error deleting assignment:', error.message);
      throw new Error(`Failed to delete shift assignment: ${error.message}`);
    }
  }

  /**
   * Get all assignments for an employee (all time)
   * @param employeeCode Employee code
   * @returns Array of all shift assignments for the employee
   */
  static async getAllForEmployee(employeeCode: string): Promise<EmployeeShiftAssignment[]> {
    try {
      const sqlQuery = `
        SELECT
          Id,
          EmployeeCode,
          ShiftName,
          FromDate,
          ToDate,
          CreatedAt
        FROM employee_shift_assignments
        WHERE employeecode = @employeeCode
        ORDER BY FromDate ASC, CreatedAt DESC
      `;

      const result = await query<any>(sqlQuery, { employeeCode });

      return result.recordset.map((row: any) => this.mapToShiftAssignment(row));
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentModel] Error fetching all assignments:', error.message);
      throw new Error(`Failed to fetch shift assignments: ${error.message}`);
    }
  }

  /**
   * Helper: Map database row to EmployeeShiftAssignment interface
   */
  private static mapToShiftAssignment(row: any): EmployeeShiftAssignment {
    return {
      Id: row.Id,
      EmployeeCode: row.EmployeeCode,
      ShiftName: row.ShiftName,
      FromDate: row.FromDate instanceof Date 
        ? row.FromDate.toISOString().split('T')[0] 
        : row.FromDate,
      ToDate: row.ToDate instanceof Date 
        ? row.ToDate.toISOString().split('T')[0] 
        : row.ToDate,
      CreatedAt: row.CreatedAt,
    };
  }
}

export default EmployeeShiftAssignmentModel;

