/**
 * Salary Routes
 * Route definitions for salary and payroll endpoints
 */

import express, { Router } from 'express';
import { SalaryController } from '../controllers/SalaryController.js';
import { SalaryAdjustmentController } from '../controllers/SalaryAdjustmentController.js';
import { SalaryHoldController } from '../controllers/SalaryHoldController.js';
import { validateRequest, schemas, Joi } from '../utils/validation.js';

const router: Router = express.Router();

/**
 * GET /api/salary/summary
 * Get salary summary for all employees in EmployeeDetails table
 * Query params: month (YYYY-MM), chunkSize (default: 10)
 * Processes in chunks to prevent server overload
 */
router.get('/summary', SalaryController.getSalarySummary);

/**
 * GET /api/salary/:userId
 * Calculate and return salary for an employee for a given month
 * Path params: userId (employee user ID)
 * Query params: month (YYYY-MM, defaults to current month)
 */
router.get(
  '/:userId',
  validateRequest(
    Joi.object({
      month: schemas.month.optional(),
      joinDate: schemas.date.optional(),
      exitDate: schemas.date.optional(),
      // Optional leave approvals – allow single date or repeated query params
      paidLeave: Joi.alternatives().try(
        Joi.array().items(schemas.date),
        schemas.date
      ).optional(),
      casualLeave: Joi.alternatives().try(
        Joi.array().items(schemas.date),
        schemas.date
      ).optional(),
    })
  ),
  SalaryController.calculateSalary
);

/**
 * GET /api/salary/:userId/hours
 * Get detailed monthly hours breakdown for an employee
 * Path params: userId (employee user ID)
 * Query params: month (YYYY-MM, defaults to current month)
 */
router.get(
  '/:userId/hours',
  validateRequest(
    Joi.object({
      month: schemas.month.optional(),
    })
  ),
  SalaryController.getMonthlyHours
);

/**
 * GET /api/salary/:userId/breakdown/:month
 * Get detailed daily attendance breakdown for salary calculation
 * Path params: userId (employee user ID), month (YYYY-MM)
 */
router.get('/:userId/breakdown/:month', SalaryController.getDailyBreakdown);

/**
 * GET /api/salary/:userId/recent-attendance
 * Get last 10 working days of attendance data from today backwards
 * Path params: userId (employee user ID)
 */
router.get('/:userId/recent-attendance', SalaryController.getRecentAttendance);

/**
 * POST /api/salary/batch
 * Calculate salary for multiple employees
 * Body: { employeeCodes: string[], month: string }
 */
router.post('/batch', SalaryController.batchCalculateSalary);

/**
 * GET /api/salary/adjustments/:employeeCode?month=YYYY-MM
 * Get all salary adjustments for an employee for a specific month
 */
router.get(
  '/adjustments/:employeeCode',
  validateRequest(
    Joi.object({
      month: schemas.month.required(),
    })
  ),
  SalaryAdjustmentController.getAdjustments
);

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
router.post(
  '/adjustment',
  validateRequest(
    Joi.object({
      employeeCode: Joi.string().required(),
      month: schemas.month.required(),
      type: Joi.string().valid('DEDUCTION', 'ADDITION').required(),
      category: Joi.string().max(50).required(),
      amount: Joi.number().min(0).required(),
      description: Joi.string().max(255).optional(),
      createdBy: Joi.string().max(50).optional(),
    }),
    'body' // Validate request body, not query parameters
  ),
  SalaryAdjustmentController.saveAdjustment
);

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
router.post(
  '/hold',
  validateRequest(
    Joi.object({
      employeeCode: Joi.string().required(),
      month: schemas.month.required(),
      reason: Joi.string().max(255).allow(null, '').optional(),
      actionBy: Joi.string().max(50).allow(null, '').optional(),
    }),
    'body'
  ),
  SalaryHoldController.createHold
);

/**
 * POST /api/salary/release-hold
 * Release a salary hold
 * Body: {
 *   employeeCode: string,
 *   month: string (YYYY-MM),
 *   actionBy?: string
 * }
 */
router.post(
  '/release-hold',
  validateRequest(
    Joi.object({
      employeeCode: Joi.string().required(),
      month: schemas.month.required(),
      actionBy: Joi.string().max(50).optional(),
    }),
    'body'
  ),
  SalaryHoldController.releaseHold
);

/**
 * GET /api/salary/hold/:employeeCode?month=YYYY-MM
 * Get salary hold status for an employee and month
 * Path params: employeeCode
 * Query params: month (YYYY-MM)
 */
router.get(
  '/hold/:employeeCode',
  validateRequest(
    Joi.object({
      month: schemas.month.required(),
    })
  ),
  SalaryHoldController.getHold
);

/**
 * GET /api/salary/:userId/status?month=YYYY-MM
 * Get salary finalized status for an employee and month
 * Path params: userId (employee user ID)
 * Query params: month (YYYY-MM, defaults to current month)
 */
router.get(
  '/:userId/status',
  validateRequest(
    Joi.object({
      month: schemas.month.optional(),
    })
  ),
  SalaryController.getSalaryStatus
);

/**
 * POST /api/salary/:userId/finalize
 * Finalize salary for an employee and month
 * Changes Status from DRAFT (0) to FINALIZED (1)
 * Path params: userId (employee user ID)
 * Body: { month: "YYYY-MM" }
 */
router.post(
  '/:userId/finalize',
  validateRequest(
    Joi.object({
      month: schemas.month.required(),
    }),
    'body'
  ),
  SalaryController.finalizeSalary
);

/**
 * POST /api/salary/finalize-all
 * Finalize all salaries for a specific month
 * Changes Status from DRAFT (0) to FINALIZED (1) for all employees
 * Body: { month: "YYYY-MM" }
 */
router.post(
  '/finalize-all',
  validateRequest(
    Joi.object({
      month: schemas.month.required(),
    }),
    'body'
  ),
  SalaryController.finalizeAllSalaries
);

export default router;

