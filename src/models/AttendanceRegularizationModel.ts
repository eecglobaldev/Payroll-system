import { query } from '../db/pool.js';

export interface AttendanceRegularization {
  Id: number;
  EmployeeCode: string;
  RegularizationDate: Date;
  OriginalStatus: string;
  RegularizedStatus: string;
  Month: string;
  Reason?: string;
  RequestedBy?: string;
  ApprovedBy: string;
  Status: string;
  CreatedAt: Date;
  UpdatedAt?: Date;
}

export class AttendanceRegularizationModel {
  /**
   * Save attendance regularizations for an employee
   * @param employeeCode Employee code
   * @param month Month in YYYY-MM format
   * @param regularizations Array of regularization records
   * @param approvedBy Admin username
   */
  static async saveRegularizations(
    employeeCode: string,
    month: string,
    regularizations: Array<{
      date: string;
      originalStatus: string;
      regularizedStatus?: string; // 'half-day' or 'full-day'
      reason?: string;
    }>,
    approvedBy: string,
    requestedBy?: string
  ): Promise<void> {
    for (const reg of regularizations) {
      // Default to 'full-day' if not specified
      const regularizedStatus = reg.regularizedStatus || 'full-day';
      
      await query(`
          INSERT INTO attendanceregularization (
            employeecode,
            regularizationdate,
            originalstatus,
            regularizedstatus,
            month,
            reason,
            requestedby,
            approvedby,
            status
          )
          VALUES (
            @employeeCode,
            @regularizationDate,
            @originalStatus,
            @regularizedStatus,
            @month,
            @reason,
            @requestedBy,
            @approvedBy,
            @status
          )
          ON CONFLICT (employeecode, regularizationdate) 
          DO UPDATE SET
            originalstatus = EXCLUDED.originalstatus,
            regularizedstatus = EXCLUDED.regularizedstatus,
            month = EXCLUDED.month,
            reason = EXCLUDED.reason,
            requestedby = EXCLUDED.requestedby,
            approvedby = EXCLUDED.approvedby,
            status = EXCLUDED.status,
            updatedat = CURRENT_TIMESTAMP
        `, {
          employeeCode,
          regularizationDate: reg.date,
          originalStatus: reg.originalStatus,
          regularizedStatus,
          month,
          reason: reg.reason || null,
          requestedBy: requestedBy || null,
          approvedBy,
          status: 'APPROVED'
        });
    }
  }

  /**
   * Get attendance regularizations for an employee and month
   * @param employeeCode Employee code
   * @param month Month in YYYY-MM format
   */
  static async getRegularizations(
    employeeCode: string,
    month: string
  ): Promise<AttendanceRegularization[]> {
    const result = await query<AttendanceRegularization>(`
        SELECT 
          id,
          employeecode,
          regularizationdate,
          originalstatus,
          regularizedstatus,
          month,
          reason,
          requestedby,
          approvedby,
          status,
          createdat,
          updatedat
        FROM attendanceregularization
        WHERE employeecode = @employeeCode
          AND month = @month
          AND status = 'APPROVED'
        ORDER BY regularizationdate
      `, { employeeCode, month });

    return result.recordset;
  }

  /**
   * Delete a regularization
   * @param employeeCode Employee code
   * @param date Date to delete regularization for
   */
  static async deleteRegularization(
    employeeCode: string,
    date: string
  ): Promise<void> {
    await query(`
        DELETE FROM attendanceregularization
        WHERE employeecode = @employeeCode
          AND regularizationdate = @date
      `, { employeeCode, date });
  }

  /**
   * Get regularizations by date range
   * @param employeeCode Employee code
   * @param startDate Start date
   * @param endDate End date
   */
  static async getRegularizationsByDateRange(
    employeeCode: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceRegularization[]> {
    const result = await query<AttendanceRegularization>(`
        SELECT 
          id,
          employeecode,
          regularizationdate,
          originalstatus,
          regularizedstatus,
          month,
          reason,
          requestedby,
          approvedby,
          status,
          createdat,
          updatedat
        FROM attendanceregularization
        WHERE employeecode = @employeeCode
          AND regularizationdate >= @startDate
          AND regularizationdate <= @endDate
          AND status = 'APPROVED'
        ORDER BY regularizationdate
      `, { employeeCode, startDate, endDate });

    return result.recordset;
  }
}
