/**
 * Leave Routes
 * Route definitions for leave management endpoints
 * 
 * API Endpoints:
 * - POST /api/leave/approve - Save monthly leave approvals
 * - GET /api/leave/:employeeCode/balance - Get leave balance
 * - GET /api/leave/:employeeCode/monthly/:month - Get monthly leave usage
 */

import express, { Router } from 'express';
import { LeaveController } from '../controllers/LeaveController.js';
import { validateRequest, schemas, Joi } from '../utils/validation.js';

const router: Router = express.Router();

/**
 * POST /api/leave/approve
 * Save or update monthly leave approvals
 * 
 * Body: {
 *   employeeCode: string,
 *   month: string (YYYY-MM),
 *   paidLeaveDates: string[] (YYYY-MM-DD),
 *   casualLeaveDates: string[] (YYYY-MM-DD),
 *   approvedBy?: string
 * }
 */
router.post(
  '/approve',
  validateRequest(
    Joi.object({
      employeeCode: Joi.string().required(),
      month: schemas.month.required(),
      paidLeaveDates: Joi.array().default([]),
      casualLeaveDates: Joi.array().default([]),
      approvedBy: Joi.string().max(100).optional(),
    }),
    'body'
  ),
  LeaveController.approveLeave
);

/**
 * GET /api/leave/:employeeCode/balance
 * Get leave balance for an employee
 * 
 * Path params: employeeCode
 * Query params: year (required), month (optional)
 */
router.get(
  '/:employeeCode/balance',
  validateRequest(
    Joi.object({
      year: Joi.number().integer().min(2000).max(2100).required(),
      month: schemas.month.optional(),
    }),
    'query'
  ),
  LeaveController.getLeaveBalance
);

/**
 * GET /api/leave/:employeeCode/monthly/:month
 * Get monthly leave usage for an employee
 * 
 * Path params: employeeCode, month (YYYY-MM)
 */
router.get(
  '/:employeeCode/monthly/:month',
  LeaveController.getMonthlyLeaveUsage
);

export default router;

