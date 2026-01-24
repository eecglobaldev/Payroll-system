/**
 * Attendance Model
 * Database interactions for attendance data from DeviceLogs tables
 */

import { query } from '../db/pool.js';
import { AttendanceLog, AttendanceSummary, QueryParameters } from '../types/index.js';
import { getCurrentDeviceLogsTable, getDeviceLogsTableForDate, getDeviceLogsTablesForRange } from '../config/database.js';
import { mapAttendanceLogs, mapAttendanceSummary } from '../utils/columnMapper.js';

export class AttendanceModel {
  /**
   * Get latest attendance logs
   */
  static async getLatest(limit: number = 100): Promise<AttendanceLog[]> {
    const tableName = getCurrentDeviceLogsTable();
    const sqlQuery = `
      SELECT 
        devicelogid,
        downloaddate,
        deviceid,
        userid,
        TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
        direction,
        attdirection,
        c1, c2, c3, c4, c5, c6, c7,
        workcode,
        updateflag,
        employeeimage,
        filename,
        longitude,
        latitude,
        isapproved,
        createddate,
        lastmodifieddate,
        locationaddress,
        bodytemperature,
        ismaskon
      FROM ${tableName}
      ORDER BY logdate ASC
      LIMIT @limit
    `;

    const result = await query<AttendanceLog>(sqlQuery, { limit });
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }

  /**
   * Get attendance logs by date
   */
  static async getByDate(date: string): Promise<AttendanceLog[]> {
    const tableName = getDeviceLogsTableForDate(date);
    const sqlQuery = `
      SELECT 
        devicelogid,
        downloaddate,
        deviceid,
        userid,
        TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
        direction,
        attdirection,
        c1, c2, c3, c4, c5, c6, c7,
        workcode,
        updateflag,
        employeeimage,
        filename,
        longitude,
        latitude,
        isapproved,
        createddate,
        lastmodifieddate,
        locationaddress,
        bodytemperature,
        ismaskon
      FROM ${tableName}
      WHERE DATE(logdate) = @date
      ORDER BY logdate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { date });
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }

  /**
   * Get attendance logs for an employee within date range
   * Note: userid in devicelogs is stored as VARCHAR (string), not integer
   * It stores the EmployeeCode (e.g., '9999'), not EmployeeId
   */
  static async getByEmployeeAndDateRange(
    userId: number | string,
    start: string,
    end: string
  ): Promise<AttendanceLog[]> {
    const tables = getDeviceLogsTablesForRange(start, end);
    
    // Convert userId to string since userid column is VARCHAR
    // In devicelogs, userid stores EmployeeCode as string (e.g., '9999')
    const userIdStr = String(userId);
    
    
    // If multiple tables, use UNION
    if (tables.length > 1) {
      const unionQuery = tables
        .map(table => `
          SELECT 
            devicelogid,
            downloaddate,
            deviceid,
            userid,
            TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
            direction,
            attdirection,
            c1, c2, c3, c4, c5, c6, c7,
            workcode,
            updateflag,
            employeeimage,
            filename,
            longitude,
            latitude,
            isapproved,
            createddate,
            lastmodifieddate,
            locationaddress,
            bodytemperature,
            ismaskon
          FROM ${table}
          WHERE userid = @userId
            AND DATE(logdate) BETWEEN @start AND @end
        `)
        .join(' UNION ALL ');
      
      const sqlQuery = `
        ${unionQuery}
        ORDER BY logdate
      `;
      
      const result = await query<AttendanceLog>(sqlQuery, { userId: userIdStr, start, end });
      // Map PostgreSQL lowercase column names to PascalCase
      return mapAttendanceLogs(result.recordset);
    }
    
    // Single table query
    // Format logdate as string to avoid timezone conversion issues
    const sqlQuery = `
      SELECT 
        devicelogid,
        downloaddate,
        deviceid,
        userid,
        TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
        direction,
        attdirection,
        c1, c2, c3, c4, c5, c6, c7,
        workcode,
        updateflag,
        employeeimage,
        filename,
        longitude,
        latitude,
        isapproved,
        createddate,
        lastmodifieddate,
        locationaddress,
        bodytemperature,
        ismaskon
      FROM ${tables[0]}
      WHERE userid = @userId
        AND DATE(logdate) BETWEEN @start AND @end
      ORDER BY logdate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId: userIdStr, start, end });
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }

  /**
   * Get attendance summary for an employee within date range
   * Note: userid in devicelogs is stored as VARCHAR (string), not integer
   * It stores the EmployeeCode (e.g., '9999'), not EmployeeId
   */
  static async getSummaryByEmployeeAndDateRange(
    userId: number | string,
    start: string,
    end: string
  ): Promise<AttendanceSummary | null> {
    const tables = getDeviceLogsTablesForRange(start, end);
    
    // Convert userId to string since userid column is VARCHAR
    // In devicelogs, userid stores EmployeeCode as string (e.g., '9999')
    const userIdStr = String(userId);
    
    // If multiple tables, use UNION
    if (tables.length > 1) {
      const unionQuery = tables
        .map(table => `
          SELECT 
            userid,
            logdate
          FROM ${table}
          WHERE userid = @userId
            AND DATE(logdate) BETWEEN @start AND @end
        `)
        .join(' UNION ALL ');
      
      const sqlQuery = `
        SELECT 
          userid,
          COUNT(DISTINCT DATE(logdate)) as DaysPresent,
          COUNT(*) as TotalLogs,
          MIN(logdate) as FirstEntry,
          MAX(logdate) as LastEntry
        FROM (${unionQuery}) AS CombinedLogs
        GROUP BY userid
      `;
      
      const result = await query<AttendanceSummary>(sqlQuery, { userId: userIdStr, start, end });
      // Map PostgreSQL lowercase column names to PascalCase
      return result.recordset.length > 0 ? mapAttendanceSummary(result.recordset[0]) : null;
    }
    
    // Single table query
    const sqlQuery = `
      SELECT 
        userid,
        COUNT(DISTINCT DATE(logdate)) as DaysPresent,
        COUNT(*) as TotalLogs,
        MIN(logdate) as FirstEntry,
        MAX(logdate) as LastEntry
      FROM ${tables[0]}
      WHERE userid = @userId
        AND DATE(logdate) BETWEEN @start AND @end
      GROUP BY userid
    `;

    const result = await query<AttendanceSummary>(sqlQuery, { userId: userIdStr, start, end });
    // Map PostgreSQL lowercase column names to PascalCase
    return result.recordset.length > 0 ? mapAttendanceSummary(result.recordset[0]) : null;
  }

  /**
   * Get daily attendance for an employee on a specific date
   */
  static async getDailyByEmployeeAndDate(
    userId: number | string,
    date: string
  ): Promise<AttendanceLog[]> {
    const tableName = getDeviceLogsTableForDate(date);
    const sqlQuery = `
      SELECT 
        devicelogid,
        downloaddate,
        deviceid,
        userid,
        TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
        direction,
        attdirection,
        c1, c2, c3, c4, c5, c6, c7,
        workcode,
        updateflag,
        employeeimage,
        filename,
        longitude,
        latitude,
        isapproved,
        createddate,
        lastmodifieddate,
        locationaddress,
        bodytemperature,
        ismaskon
      FROM ${tableName}
      WHERE userid = @userId
        AND DATE(logdate) = @date
      ORDER BY logdate
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId: String(userId), date });
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }

  /**
   * Get attendance logs by UserId (employee ID)
   */
  static async getByUserId(userId: number, limit: number = 100): Promise<AttendanceLog[]> {
    const tableName = getCurrentDeviceLogsTable();
    const sqlQuery = `
      SELECT 
        devicelogid,
        downloaddate,
        deviceid,
        userid,
        TO_CHAR(logdate, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as logdate,
        direction,
        attdirection,
        c1, c2, c3, c4, c5, c6, c7,
        workcode,
        updateflag,
        employeeimage,
        filename,
        longitude,
        latitude,
        isapproved,
        createddate,
        lastmodifieddate,
        locationaddress,
        bodytemperature,
        ismaskon
      FROM ${tableName}
      WHERE userid = @userId
      ORDER BY logdate DESC
      LIMIT @limit
    `;

    const result = await query<AttendanceLog>(sqlQuery, { userId: String(userId), limit });
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }

  /**
   * Get attendance logs by custom query parameters
   */
  static async getByCustomQuery(
    sqlQuery: string,
    params: QueryParameters
  ): Promise<AttendanceLog[]> {
    const result = await query<AttendanceLog>(sqlQuery, params);
    // Map PostgreSQL lowercase column names to PascalCase
    return mapAttendanceLogs(result.recordset);
  }
}

export default AttendanceModel;

