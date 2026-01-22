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
          MERGE INTO dbo.AttendanceRegularization AS target
          USING (
            SELECT 
              @employeeCode AS EmployeeCode,
              @regularizationDate AS RegularizationDate
          ) AS source
          ON target.EmployeeCode = source.EmployeeCode 
            AND target.RegularizationDate = source.RegularizationDate
          WHEN MATCHED THEN
            UPDATE SET
              OriginalStatus = @originalStatus,
              RegularizedStatus = @regularizedStatus,
              Month = @month,
              Reason = @reason,
              RequestedBy = @requestedBy,
              ApprovedBy = @approvedBy,
              Status = @status,
              UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (
              EmployeeCode,
              RegularizationDate,
              OriginalStatus,
              RegularizedStatus,
              Month,
              Reason,
              RequestedBy,
              ApprovedBy,
              Status
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
            );
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
    _employeeCode: string,
    _month: string
  ): Promise<AttendanceRegularization[]> {
    const result = await query<AttendanceRegularization>(`
        SELECT 
          Id,
          EmployeeCode,
          RegularizationDate,
          OriginalStatus,
          RegularizedStatus,
          Month,
          Reason,
          RequestedBy,
          ApprovedBy,
          Status,
          CreatedAt,
          UpdatedAt
        FROM dbo.AttendanceRegularization
        WHERE EmployeeCode = @employeeCode
          AND Month = @month
          AND Status = 'APPROVED'
        ORDER BY RegularizationDate
      `);

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
        DELETE FROM dbo.AttendanceRegularization
        WHERE EmployeeCode = @employeeCode
          AND RegularizationDate = @date
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
          Id,
          EmployeeCode,
          RegularizationDate,
          OriginalStatus,
          RegularizedStatus,
          Month,
          Reason,
          RequestedBy,
          ApprovedBy,
          Status,
          CreatedAt,
          UpdatedAt
        FROM dbo.AttendanceRegularization
        WHERE EmployeeCode = @employeeCode
          AND RegularizationDate >= @startDate
          AND RegularizationDate <= @endDate
          AND Status = 'APPROVED'
        ORDER BY RegularizationDate
      `, { employeeCode, startDate, endDate });

    return result.recordset;
  }
}

