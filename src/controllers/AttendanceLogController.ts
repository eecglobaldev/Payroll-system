/**
 * Attendance Log Controller
 * Handles raw device log queries
 */

import { Request, Response } from 'express';
import { query } from '../db/pool.js';
import { getDeviceLogsTableForDate } from '../config/database.js';

export class AttendanceLogController {
  /**
   * Get raw device logs for an employee on a specific date
   * GET /api/attendance/logs/:userId/:date
   */
  static async getRawLogs(req: Request, res: Response): Promise<void> {
    try {
      const { userId, date } = req.params;

      if (!userId || !date) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: userId and date'
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
        return;
      }

      // Get the correct table name for this date
      const tableName = getDeviceLogsTableForDate(date);

      const sqlQuery = `
        SELECT 
          UserId,
          LogDate,
          Direction,
          DeviceId
        FROM ${tableName}
        WHERE UserId = @userId
          AND CAST(LogDate AS DATE) = CAST(@date AS DATE)
        ORDER BY LogDate ASC
      `;

      const result = await query<any>(sqlQuery, { 
        userId: parseInt(userId, 10), 
        date 
      });

      // Helper function to parse SQL Server datetime as local time (no timezone conversion)
      const parseAsLocalTime = (timestamp: Date | string): Date => {
        if (timestamp instanceof Date) {
          const d = timestamp as Date;
          // Get UTC components (which actually represent local time values from SQL Server)
          return new Date(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            d.getUTCHours(),
            d.getUTCMinutes(),
            d.getUTCSeconds(),
            d.getUTCMilliseconds()
          );
        }
        
        const timestampStr = String(timestamp);
        
        // If string has 'Z' suffix, parse components manually
        if (timestampStr.endsWith('Z')) {
          const match = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z?$/);
          
          if (match) {
            const [, year, month, day, hour, minute, second, ms] = match;
            return new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hour),
              parseInt(minute),
              parseInt(second),
              parseInt(ms || '0')
            );
          }
        }
        
        return new Date(timestamp);
      };

      const logs = result.recordset.map((row: any) => {
        const localDate = parseAsLocalTime(row.LogDate);
        const hours = localDate.getHours();
        const minutes = localDate.getMinutes();
        const seconds = localDate.getSeconds();
        
        // Format as HH:MM:SS AM/PM
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const timeStr = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
        
        return {
          userId: row.UserId,
          logDate: row.LogDate,
          direction: row.Direction || 'in',
          deviceId: row.DeviceId,
          time: timeStr,
          timestamp: localDate.getTime() // For sorting
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp) // Sort by actual time
      .map(({ timestamp, ...log }) => log); // Remove timestamp from response

      res.json({
        success: true,
        data: {
          userId: parseInt(userId, 10),
          date,
          logCount: logs.length,
          logs
        }
      });
    } catch (error: any) {
      console.error('[AttendanceLogController] Error fetching raw logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance logs',
        error: error.message
      });
    }
  }
}

export default AttendanceLogController;

