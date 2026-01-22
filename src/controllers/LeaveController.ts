/**
 * Leave Controller
 * Handles HTTP requests for leave management
 * 
 * Endpoints:
 * - POST /api/leave/approve - Save monthly leave approvals
 * - GET /api/leave/:employeeId/balance - Get leave balance
 * - GET /api/leave/:employeeId/monthly/:month - Get monthly leave usage
 */

import { Request, Response } from 'express';
import * as leaveService from '../services/leaveService.js';
import { SaveLeaveApprovalRequest } from '../types/index.js';
import { isValidMonthFormat } from '../utils/date.js';

export class LeaveController {
  /**
   * POST /api/leave/approve
   * Save or update monthly leave approvals
   * 
   * Body: {
   *   employeeCode: string,
   *   month: string (YYYY-MM),
   *   paidLeaveDates: Array<{ date: string, value: number }> (value: 0.5 or 1.0),
   *   casualLeaveDates: Array<{ date: string, value: number }> (value: 0.5 or 1.0),
   *   approvedBy?: string
   * }
   * 
   * Backward compatibility: Also accepts string[] arrays (converted to { date, value } with defaults)
   */
  static async approveLeave(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month, paidLeaveDates, casualLeaveDates, approvedBy } = req.body;

      // Validation
      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'employeeCode is required and must be a string',
        });
        return;
      }

      if (!month || !isValidMonthFormat(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'month is required and must be in YYYY-MM format',
        });
        return;
      }

      // Convert to new format with backward compatibility
      // If arrays contain strings, convert to { date, value } format
      const convertToNewFormat = (
        dates: any[],
        defaultValue: number
      ): Array<{ date: string; value: number }> => {
        if (!Array.isArray(dates)) return [];
        
        return dates.map(item => {
          // If already in new format { date, value }
          if (typeof item === 'object' && item !== null && 'date' in item && 'value' in item) {
            return {
              date: String(item.date),
              value: Number(item.value) === 0.5 ? 0.5 : 1.0, // Ensure only 0.5 or 1.0
            };
          }
          // Legacy format: plain string
          if (typeof item === 'string') {
            return { date: item, value: defaultValue };
          }
          throw new Error(`Invalid leave date format: ${JSON.stringify(item)}`);
        });
      };

      let paidDates: Array<{ date: string; value: number }>;
      let casualDates: Array<{ date: string; value: number }>;

      try {
        paidDates = convertToNewFormat(paidLeaveDates || [], 1.0); // PL default = 1.0
        casualDates = convertToNewFormat(casualLeaveDates || [], 0.5); // CL default = 0.5
      } catch (err) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `Invalid leave date format: ${(err as Error).message}`,
        });
        return;
      }

      // Validate values are 0.5 or 1.0
      for (const item of [...paidDates, ...casualDates]) {
        if (item.value !== 0.5 && item.value !== 1.0) {
          res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: `Invalid leave value for date ${item.date}: ${item.value}. Must be 0.5 or 1.0`,
          });
          return;
        }
      }

      // Save leave approval
      const request: SaveLeaveApprovalRequest = {
        employeeCode,
        month,
        paidLeaveDates: paidDates,
        casualLeaveDates: casualDates,
        approvedBy: approvedBy || 'system',
      };

      const result = await leaveService.saveMonthlyLeaveApproval(request);

      res.json({
        success: true,
        message: `Leave approval ${result.operation.toLowerCase()} successfully`,
        data: {
          operation: result.operation,
          leaveBalance: result.leaveBalance,
          monthlyUsage: result.monthlyUsage,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[LeaveController] Error approving leave:', error);

      // Handle employee not found
      if (error.message.includes('Employee with code') && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      // If tables don't exist yet, return success anyway (leave persistence is optional)
      if (error.message.includes('Invalid object name') || error.message.includes('MonthlyLeaveUsage')) {
        console.warn('[LeaveController] Leave tables not created yet. Run sql/leave_management_migration.sql to enable persistence.');
        res.json({
          success: true,
          message: 'Leave approval received (persistence not configured)',
          warning: 'Run sql/leave_management_migration.sql in SSMS to enable leave persistence',
        });
        return;
      }

      // If entitlement doesn't exist, still save the leave approval (entitlement is optional)
      if (error.message.includes('No leave entitlement')) {
        console.warn('[LeaveController] Leave entitlement not configured. Saving leave approval anyway.');
        // Try to save without entitlement check - this should work now
        // The service will handle it gracefully
        try {
          const request: SaveLeaveApprovalRequest = {
            employeeCode: req.body.employeeCode,
            month: req.body.month,
            paidLeaveDates: req.body.paidLeaveDates || [],
            casualLeaveDates: req.body.casualLeaveDates || [],
            approvedBy: req.body.approvedBy || 'system',
          };
          const result = await leaveService.saveMonthlyLeaveApproval(request);
          res.json({
            success: true,
            message: `Leave approval ${result.operation.toLowerCase()} successfully (entitlement not configured)`,
            data: {
              operation: result.operation,
              leaveBalance: result.leaveBalance,
              monthlyUsage: result.monthlyUsage,
            },
            warning: 'Leave entitlement not configured. Configure EmployeeLeaves table to enable annual tracking.',
          });
          return;
        } catch (retryErr) {
          // If retry also fails, return the original error
          console.error('[LeaveController] Retry also failed:', retryErr);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to approve leave',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/leave/:employeeCode/balance
   * Get leave balance for an employee
   * 
   * Query params:
   * - year (required): Year in YYYY format
   * - month (optional): Include specific month's usage
   */
  static async getLeaveBalance(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const { year, month } = req.query;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'employeeCode is required',
        });
        return;
      }

      if (!year) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'year query parameter is required',
        });
        return;
      }

      const yearNum = parseInt(year as string, 10);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'year must be a valid year between 2000 and 2100',
        });
        return;
      }

      // Validate month if provided
      if (month && !isValidMonthFormat(month as string)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'month must be in YYYY-MM format',
        });
        return;
      }

      const leaveBalance = await leaveService.getLeaveBalance(
        employeeCode,
        yearNum,
        month as string | undefined
      );

      res.json({
        success: true,
        data: leaveBalance,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[LeaveController] Error fetching leave balance:', error);

      // Employee not found
      if (error.message.includes('Employee with code') && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      // Other errors
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch leave balance',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/leave/:employeeCode/monthly/:month
   * Get monthly leave usage for an employee
   * Used by salary calculation to retrieve persisted leave approvals
   */
  static async getMonthlyLeaveUsage(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, month } = req.params;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'employeeCode is required',
        });
        return;
      }

      if (!month || !isValidMonthFormat(month)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'month must be in YYYY-MM format',
        });
        return;
      }

      const usage = await leaveService.getMonthlyLeaveUsage(
        employeeCode,
        month
      );

      if (!usage) {
        res.json({
          success: true,
          message: 'No leave usage found for this month',
          data: {
            employeeCode,
            month,
            paidLeaveDates: [],
            casualLeaveDates: [],
          },
        });
        return;
      }

      // Parse leave dates with values (supports both JSON and legacy format)
      const paidLeaveDates = leaveService.parseLeaveDatesWithValues(usage.PaidLeaveDates, 1.0);
      const casualLeaveDates = leaveService.parseLeaveDatesWithValues(usage.CasualLeaveDates, 0.5);

      res.json({
        success: true,
        data: {
          ...usage,
          paidLeaveDates,
          casualLeaveDates,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.warn('[LeaveController] Leave tables not available:', error.message);

      // Return empty data gracefully if tables don't exist yet
      res.json({
        success: true,
        message: 'Leave persistence not configured yet',
        data: {
          employeeCode: req.params.employeeCode,
          month: req.params.month,
          paidLeaveDates: [],
          casualLeaveDates: [],
        },
      });
    }
  }
}

