/**
 * SalaryAdjustment Controller
 * Handles HTTP requests for salary adjustments (deductions and additions)
 */

import { Request, Response } from 'express';
import { SalaryAdjustmentModel, SaveSalaryAdjustmentRequest } from '../models/SalaryAdjustmentModel.js';

export class SalaryAdjustmentController {
  /**
   * GET /api/salary/adjustments/:employeeCode?month=YYYY-MM
   * Get all salary adjustments for an employee for a specific month
   */
  static async getAdjustments(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const month = req.query.month as string;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      if (!month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month parameter is required (format: YYYY-MM)',
        });
        return;
      }

      // Validate month format (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month must be in YYYY-MM format',
        });
        return;
      }

      const adjustments = await SalaryAdjustmentModel.getAdjustments(employeeCode, month);
      const summary = await SalaryAdjustmentModel.getAdjustmentSummary(employeeCode, month);

      res.json({
        success: true,
        data: {
          adjustments,
          summary: {
            totalDeductions: summary.totalDeductions,
            totalAdditions: summary.totalAdditions,
          },
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryAdjustmentController] Error fetching adjustments:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch salary adjustments',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/salary/adjustment
   * Save or update a salary adjustment
   * Body: {
   *   employeeCode: string,
   *   month: string (YYYY-MM),
   *   type: 'DEDUCTION' | 'ADDITION',
   *   category: string,
   *   amount: number,
   *   description?: string,
   *   createdBy?: string
   * }
   */
  static async saveAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const {
        employeeCode,
        month,
        type,
        category,
        amount,
        description,
        createdBy,
      } = req.body;

      // Validation
      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      if (!month) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month is required (format: YYYY-MM)',
        });
        return;
      }

      // Validate month format
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Month must be in YYYY-MM format',
        });
        return;
      }

      if (!type || (type !== 'DEDUCTION' && type !== 'ADDITION')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Type must be DEDUCTION or ADDITION',
        });
        return;
      }

      if (!category) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Category is required',
        });
        return;
      }

      if (amount === undefined || amount === null) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Amount is required',
        });
        return;
      }

      if (typeof amount !== 'number' || amount < 0) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Amount must be a number >= 0',
        });
        return;
      }

      const payload: SaveSalaryAdjustmentRequest = {
        employeeCode,
        month,
        type: type as 'DEDUCTION' | 'ADDITION',
        category,
        amount: parseFloat(amount.toFixed(2)),
        description: description || undefined,
        createdBy: createdBy || undefined,
      };

      const result = await SalaryAdjustmentModel.upsertAdjustment(payload);

      res.json({
        success: true,
        data: {
          operation: result.operation,
          adjustment: result.record,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryAdjustmentController] Error saving adjustment:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to save salary adjustment',
        details: error.message,
      });
    }
  }
}

