import { Request, Response } from 'express';
import { AttendanceRegularizationModel } from '../models/AttendanceRegularizationModel.js';

export class AttendanceRegularizationController {
  /**
   * Save attendance regularizations
   * POST /api/attendance/regularize
   */
  static async saveRegularizations(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month, dates, reason, approvedBy, requestedBy } = req.body;

      // Validation
      if (!employeeCode || !month || !dates || !approvedBy) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: employeeCode, month, dates, approvedBy'
        });
        return;
      }

      if (!Array.isArray(dates) || dates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'dates must be a non-empty array'
        });
        return;
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          message: 'Invalid month format. Use YYYY-MM'
        });
        return;
      }

      // Validate date format for each date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const dateObj of dates) {
        if (!dateRegex.test(dateObj.date)) {
          res.status(400).json({
            success: false,
            message: `Invalid date format: ${dateObj.date}. Use YYYY-MM-DD`
          });
          return;
        }

        // Normalize originalStatus: already-regularized days may be sent as 'full-day'; treat as 'absent'
        const raw = (dateObj.originalStatus || '').toLowerCase();
        const originalStatus = raw === 'half-day' ? 'half-day' : 'absent';
        if (raw && raw !== 'absent' && raw !== 'half-day' && raw !== 'full-day') {
          res.status(400).json({
            success: false,
            message: `Invalid originalStatus for date ${dateObj.date}. Must be 'absent' or 'half-day'`
          });
          return;
        }
        (dateObj as any).originalStatus = originalStatus;
      }

      // Save regularizations
      await AttendanceRegularizationModel.saveRegularizations(
        employeeCode,
        month,
        dates.map((d: any) => ({
          date: d.date,
          originalStatus: d.originalStatus,
          regularizedStatus: d.regularizedStatus, // 'half-day' or 'full-day'
          reason: d.reason || reason
        })),
        approvedBy,
        requestedBy
      );

      res.json({
        success: true,
        message: `${dates.length} attendance regularization(s) saved successfully`,
        data: {
          employeeCode,
          month,
          count: dates.length
        }
      });
    } catch (error: any) {
      console.error('[AttendanceRegularization] Error saving regularizations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save attendance regularizations',
        error: error.message
      });
    }
  }

  /**
   * Get attendance regularizations for an employee and month
   * GET /api/attendance/regularization/:employeeCode?month=YYYY-MM
   */
  static async getRegularizations(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const { month } = req.query;

      if (!employeeCode || !month) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: employeeCode and month'
        });
        return;
      }

      // Validate month format
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid month format. Use YYYY-MM'
        });
        return;
      }

      const regularizations = await AttendanceRegularizationModel.getRegularizations(
        employeeCode,
        month as string
      );

      res.json({
        success: true,
        data: {
          employeeCode,
          month,
          regularizations: regularizations.map(reg => ({
            date: reg.RegularizationDate,
            originalStatus: reg.OriginalStatus,
            regularizedStatus: reg.RegularizedStatus,
            reason: reg.Reason,
            approvedBy: reg.ApprovedBy,
            createdAt: reg.CreatedAt
          }))
        }
      });
    } catch (error: any) {
      console.error('[AttendanceRegularization] Error fetching regularizations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance regularizations',
        error: error.message
      });
    }
  }

  /**
   * Delete a regularization
   * DELETE /api/attendance/regularization/:employeeCode/:date
   */
  static async deleteRegularization(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, date } = req.params;

      if (!employeeCode || !date) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: employeeCode and date'
        });
        return;
      }

      await AttendanceRegularizationModel.deleteRegularization(employeeCode, date);

      res.json({
        success: true,
        message: 'Regularization deleted successfully'
      });
    } catch (error: any) {
      console.error('[AttendanceRegularization] Error deleting regularization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete regularization',
        error: error.message
      });
    }
  }
}

