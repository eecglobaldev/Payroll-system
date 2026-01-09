/**
 * Attendance Controller
 * Handles attendance-related business logic
 */

import { Request, Response } from 'express';
import { AttendanceModel } from '../models/AttendanceModel.js';
import { isValidDateFormat } from '../utils/date.js';

export class AttendanceController {
  /**
   * Get latest attendance logs
   */
  static async getLatest(req: Request, res: Response): Promise<void> {
    try {
      const limitParam = req.query.limit;
      const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 100;
      const logs = await AttendanceModel.getLatest(limit);

      res.json({
        success: true,
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[AttendanceController] Error fetching latest attendance:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance logs',
      });
    }
  }

  /**
   * Get attendance logs by date
   */
  static async getByDate(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.query as { date: string };

      if (!isValidDateFormat(date)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      const logs = await AttendanceModel.getByDate(date);

      res.json({
        success: true,
        date: date,
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[AttendanceController] Error fetching attendance by date:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance logs for the specified date',
      });
    }
  }

  /**
   * Get attendance logs for an employee
   */
  static async getByEmployee(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { start, end } = req.query as { start: string; end: string };

      if (!userId) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'User ID is required',
        });
        return;
      }

      if (!isValidDateFormat(start) || !isValidDateFormat(end)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid date format. Use YYYY-MM-DD for start and end',
        });
        return;
      }

      const logs = await AttendanceModel.getByEmployeeAndDateRange(parseInt(userId, 10), start, end);

      res.json({
        success: true,
        userId: parseInt(userId, 10),
        dateRange: { start, end },
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[AttendanceController] Error fetching employee attendance:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance logs for the employee',
      });
    }
  }

  /**
   * Get attendance summary for an employee
   */
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { start, end } = req.query as { start: string; end: string };

      if (!isValidDateFormat(start) || !isValidDateFormat(end)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid date format. Use YYYY-MM-DD for start and end',
        });
        return;
      }

      const summary = await AttendanceModel.getSummaryByEmployeeAndDateRange(parseInt(userId, 10), start, end);

      if (!summary) {
        res.json({
          success: true,
          userId: parseInt(userId, 10),
          dateRange: { start, end },
          message: 'No attendance records found for this user in the specified period',
          data: null,
        });
        return;
      }

      res.json({
        success: true,
        userId: parseInt(userId, 10),
        dateRange: { start, end },
        data: summary,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[AttendanceController] Error fetching attendance summary:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve attendance summary',
      });
    }
  }

  /**
   * Get daily attendance for an employee
   */
  static async getDailyAttendance(req: Request, res: Response): Promise<void> {
    try {
      const { userId, date } = req.params;

      if (!isValidDateFormat(date)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      const logs = await AttendanceModel.getDailyByEmployeeAndDate(parseInt(userId, 10), date);

      res.json({
        success: true,
        userId: parseInt(userId, 10),
        date: date,
        count: logs.length,
        data: logs,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[AttendanceController] Error fetching daily attendance:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to retrieve daily attendance',
      });
    }
  }
}

export default AttendanceController;

