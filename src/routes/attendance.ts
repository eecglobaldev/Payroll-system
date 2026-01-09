/**
 * Attendance Routes
 * Route definitions for attendance endpoints
 */

import express, { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController.js';
import { AttendanceLogController } from '../controllers/AttendanceLogController.js';
import { validateRequest, schemas, Joi } from '../utils/validation.js';

const router: Router = express.Router();

/**
 * GET /api/attendance/latest
 * Get latest attendance logs
 * Query params: limit (default: 100, max: 1000)
 */
router.get(
  '/latest',
  validateRequest(
    Joi.object({
      limit: schemas.limit,
    })
  ),
  AttendanceController.getLatest
);

/**
 * GET /api/attendance/by-date
 * Get attendance logs for a specific date
 * Query params: date (YYYY-MM-DD)
 */
router.get(
  '/by-date',
  validateRequest(
    Joi.object({
      date: schemas.date,
    })
  ),
  AttendanceController.getByDate
);

/**
 * GET /api/attendance/employee/:userId
 * Get attendance logs for a specific employee
 * Path params: userId (employee user ID)
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
router.get(
  '/employee/:userId',
  validateRequest(
    Joi.object({
      start: schemas.date,
      end: schemas.date,
    })
  ),
  AttendanceController.getByEmployee
);

/**
 * GET /api/attendance/summary/:userId
 * Get attendance summary for an employee within a date range
 * Path params: userId (employee user ID)
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
router.get(
  '/summary/:userId',
  validateRequest(
    Joi.object({
      start: schemas.date,
      end: schemas.date,
    })
  ),
  AttendanceController.getSummary
);

/**
 * GET /api/attendance/daily/:userId/:date
 * Get attendance logs for an employee on a specific date
 * Path params: userId (employee user ID), date (YYYY-MM-DD)
 */
router.get('/daily/:userId/:date', AttendanceController.getDailyAttendance);

/**
 * POST /api/attendance/regularize
 * Save attendance regularizations
 */
import { AttendanceRegularizationController } from '../controllers/AttendanceRegularizationController.js';
router.post('/regularize', AttendanceRegularizationController.saveRegularizations);

/**
 * GET /api/attendance/regularization/:employeeCode
 * Get regularizations for employee and month
 */
router.get('/regularization/:employeeCode', AttendanceRegularizationController.getRegularizations);

/**
 * DELETE /api/attendance/regularization/:employeeCode/:date
 * Delete a regularization
 */
router.delete('/regularization/:employeeCode/:date', AttendanceRegularizationController.deleteRegularization);

// Get raw device logs for a specific date
router.get('/logs/:userId/:date', AttendanceLogController.getRawLogs);

export default router;

