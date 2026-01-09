/**
 * Overtime Controller
 * Handles overtime toggle operations per employee per month
 */

import { Request, Response } from 'express';
import { MonthlyOTModel } from '../models/MonthlyOTModel.js';

export class OvertimeController {
  /**
   * GET /api/overtime/:employeeCode/:month
   * Get overtime status for an employee for a specific month
   */
  static async getOvertimeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month } = req.params;

      if (!employeeCode || !month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'EmployeeCode and Month are required',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month must be in YYYY-MM format',
        });
        return;
      }

      const overtimeStatus = await MonthlyOTModel.getOvertimeStatus(employeeCode, month);

      res.json({
        success: true,
        data: {
          employeeCode,
          month,
          isOvertimeEnabled: overtimeStatus?.IsOvertimeEnabled || false,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[OvertimeController] Error fetching overtime status:', error);
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to retrieve overtime status',
      });
    }
  }

  /**
   * POST /api/overtime/:employeeCode/:month
   * Update overtime toggle for an employee for a specific month
   */
  static async updateOvertimeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month } = req.params;
      const { isOvertimeEnabled } = req.body;

      if (!employeeCode || !month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'EmployeeCode and Month are required',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month must be in YYYY-MM format',
        });
        return;
      }

      if (typeof isOvertimeEnabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'isOvertimeEnabled must be a boolean',
        });
        return;
      }

      const result = await MonthlyOTModel.upsertOvertimeStatus(
        employeeCode,
        month,
        isOvertimeEnabled
      );

      res.json({
        success: true,
        message: `Overtime ${isOvertimeEnabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          employeeCode,
          month,
          isOvertimeEnabled: result.record.IsOvertimeEnabled,
          operation: result.operation,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[OvertimeController] Error updating overtime status:', error);
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to update overtime status',
      });
    }
  }

  /**
   * GET /api/overtime/batch/:month
   * Get overtime status for multiple employees in a month
   * Query params: employeeCodes (comma-separated)
   */
  static async getOvertimeStatusBatch(req: Request, res: Response): Promise<void> {
    try {
      const { month } = req.params;
      const { employeeCodes } = req.query;

      if (!month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month is required',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month must be in YYYY-MM format',
        });
        return;
      }

      if (!employeeCodes || typeof employeeCodes !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'employeeCodes query parameter is required (comma-separated)',
        });
        return;
      }

      const codes = employeeCodes.split(',').map(code => code.trim()).filter(Boolean);
      
      if (codes.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'At least one employee code is required',
        });
        return;
      }

      const overtimeMap = await MonthlyOTModel.getOvertimeStatusBatch(codes, month);

      // Convert Map to object for JSON response
      const result: Record<string, boolean> = {};
      overtimeMap.forEach((value, key) => {
        result[key] = value;
      });

      res.json({
        success: true,
        data: {
          month,
          overtimeStatus: result,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[OvertimeController] Error fetching batch overtime status:', error);
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to retrieve batch overtime status',
      });
    }
  }
}

