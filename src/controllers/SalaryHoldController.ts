/**
 * SalaryHold Controller
 * Handles HTTP requests for salary hold operations
 */

import { Request, Response } from 'express';
import { SalaryHoldModel } from '../models/SalaryHoldModel.js';

export class SalaryHoldController {
  /**
   * POST /api/salary/hold
   * Create a manual salary hold
   * Body: {
   *   employeeCode: string,
   *   month: string (YYYY-MM),
   *   reason?: string,
   *   actionBy?: string
   * }
   */
  static async createHold(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month, reason, actionBy } = req.body;

      if (!employeeCode || !month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'EmployeeCode and Month are required',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      const hold = await SalaryHoldModel.createHold({
        employeeCode,
        month,
        holdType: 'MANUAL',
        reason: reason || null,
        actionBy: actionBy || null,
      });

      res.json({
        success: true,
        message: 'Salary hold created successfully',
        data: hold,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryHoldController] Error creating hold:', error);
      
      if (error.message.includes('already held')) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to create salary hold',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/salary/release-hold
   * Release a salary hold
   * Body: {
   *   employeeCode: string,
   *   month: string (YYYY-MM),
   *   actionBy?: string
   * }
   */
  static async releaseHold(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month, actionBy } = req.body;

      if (!employeeCode || !month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'EmployeeCode and Month are required',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      const hold = await SalaryHoldModel.releaseHold(
        employeeCode,
        month,
        actionBy || null
      );

      res.json({
        success: true,
        message: 'Salary hold released successfully',
        data: hold,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryHoldController] Error releasing hold:', error);
      
      if (error.message.includes('No active salary hold')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to release salary hold',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/salary/hold/:employeeCode?month=YYYY-MM
   * Get salary hold status for an employee and month
   * Path params: employeeCode
   * Query params: month (YYYY-MM)
   */
  static async getHold(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const { month } = req.query;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'EmployeeCode is required',
        });
        return;
      }

      if (!month || typeof month !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month query parameter is required (YYYY-MM)',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      const hold = await SalaryHoldModel.getHold(employeeCode, month);

      res.json({
        success: true,
        data: hold,
        isHeld: hold ? !hold.IsReleased : false,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryHoldController] Error fetching hold:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch salary hold status',
        details: error.message,
      });
    }
  }
}

