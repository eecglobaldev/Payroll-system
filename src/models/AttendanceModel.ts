/**
 * Attendance Model
 * Database interactions for attendance data from DeviceLogs tables
 */

import { query } from '../db/pool.js';
import { AttendanceLog, AttendanceSummary, QueryParameters } from '../types/index.js';
import { getCurrentDeviceLogsTable, getDeviceLogsTableForDate, getDeviceLogsTablesForRange } from '../config/database.js';

export class AttendanceModel {
  /**
   * Get latest attendance logs
   */
  static async getLatest(limit: number = 100): Promise<AttendanceLog[]> {
    const tableName = getCurrentDeviceLogsTable();
    const sqlQuery = `
      SELECT TOP (@limit) *
      FROM ${tableName}
      ORDER BY LogDate ASC
    `;

    const result = await query<AttendanceLog>(sqlQuery, { limit });
    return result.recordset;
  }

  /**
   * Get attendance logs by date
   */
  static async getByDate(date: string): Promise<AttendanceLog[]> {
    const tableName = getDeviceLogsTableForDate(date);
    const sqlQuery = `
      SELECT *
      FROM ${tableName}
      WHERE CONVERT(date, LogDate) = @date
      ORDER BY LogDate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { date });
    return result.recordset;
  }

  /**
   * Get attendance logs for an employee within date range
   */
  static async getByEmployeeAndDateRange(
    userId: number,
    start: string,
    end: string
  ): Promise<AttendanceLog[]> {
    const tables = getDeviceLogsTablesForRange(start, end);
    
    // If multiple tables, use UNION
    if (tables.length > 1) {
      const unionQuery = tables
        .map(table => `
          SELECT *
          FROM ${table}
          WHERE UserId = @userId
            AND CONVERT(date, LogDate) BETWEEN @start AND @end
        `)
        .join(' UNION ALL ');
      
      const sqlQuery = `
        ${unionQuery}
        ORDER BY LogDate
      `;
      
      const result = await query<AttendanceLog>(sqlQuery, { userId, start, end });
      return result.recordset;
    }
    
    // Single table query
    const sqlQuery = `
      SELECT *
      FROM ${tables[0]}
      WHERE UserId = @userId
        AND CONVERT(date, LogDate) BETWEEN @start AND @end
      ORDER BY LogDate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId, start, end });
    return result.recordset;
  }

  /**
   * Get attendance summary for an employee within date range
   */
  static async getSummaryByEmployeeAndDateRange(
    userId: number,
    start: string,
    end: string
  ): Promise<AttendanceSummary | null> {
    const tables = getDeviceLogsTablesForRange(start, end);
    
    // If multiple tables, use UNION
    if (tables.length > 1) {
      const unionQuery = tables
        .map(table => `
          SELECT 
            UserId,
            LogDate
          FROM ${table}
          WHERE UserId = @userId
            AND CONVERT(date, LogDate) BETWEEN @start AND @end
        `)
        .join(' UNION ALL ');
      
      const sqlQuery = `
        SELECT 
          UserId,
          COUNT(DISTINCT CONVERT(date, LogDate)) as DaysPresent,
          COUNT(*) as TotalLogs,
          MIN(LogDate) as FirstEntry,
          MAX(LogDate) as LastEntry
        FROM (${unionQuery}) AS CombinedLogs
        GROUP BY UserId
      `;
      
      const result = await query<AttendanceSummary>(sqlQuery, { userId, start, end });
      return result.recordset.length > 0 ? result.recordset[0] : null;
    }
    
    // Single table query
    const sqlQuery = `
      SELECT 
        UserId,
        COUNT(DISTINCT CONVERT(date, LogDate)) as DaysPresent,
        COUNT(*) as TotalLogs,
        MIN(LogDate) as FirstEntry,
        MAX(LogDate) as LastEntry
      FROM ${tables[0]}
      WHERE UserId = @userId
        AND CONVERT(date, LogDate) BETWEEN @start AND @end
      GROUP BY UserId
    `;

    const result = await query<AttendanceSummary>(sqlQuery, { userId, start, end });
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Get daily attendance for an employee on a specific date
   */
  static async getDailyByEmployeeAndDate(
    userId: number,
    date: string
  ): Promise<AttendanceLog[]> {
    const tableName = getDeviceLogsTableForDate(date);
    const sqlQuery = `
      SELECT *
      FROM ${tableName}
      WHERE UserId = @userId
        AND CONVERT(date, LogDate) = @date
      ORDER BY LogDate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId, date });
    return result.recordset;
  }

  /**
   * Get attendance logs by UserId (employee ID)
   */
  static async getByUserId(userId: number, limit: number = 100): Promise<AttendanceLog[]> {
    const tableName = getCurrentDeviceLogsTable();
    const sqlQuery = `
      SELECT TOP (@limit) *
      FROM ${tableName}
      WHERE UserId = @userId
      ORDER BY LogDate DESC
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId, limit });
    return result.recordset;
  }

  /**
   * Get attendance logs by custom query parameters
   */
  static async getByCustomQuery(
    sqlQuery: string,
    params: QueryParameters
  ): Promise<AttendanceLog[]> {
    const result = await query<AttendanceLog>(sqlQuery, params);
    return result.recordset;
  }
}

export default AttendanceModel;

