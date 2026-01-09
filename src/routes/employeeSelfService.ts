/**
 * Employee Self-Service Routes
 * Employee-only endpoints (read-only access to own data)
 * All routes require JWT authentication
 */

import { Router } from 'express';
import { EmployeeSelfServiceController } from '../controllers/EmployeeSelfServiceController.js';
import { verifyJWT } from '../middleware/jwtAuth.js';

const router = Router();

// All routes require JWT authentication
router.use(verifyJWT);

/**
 * GET /api/employee/me
 * Get current employee's profile
 */
router.get('/me', EmployeeSelfServiceController.getProfile);

/**
 * PATCH /api/employee/me
 * Update current employee's profile (limited fields)
 */
router.patch('/me', EmployeeSelfServiceController.updateProfile);

/**
 * GET /api/employee/salary?month=YYYY-MM
 * Get current employee's salary for a specific month
 */
router.get('/salary', EmployeeSelfServiceController.getSalary);

/**
 * GET /api/employee/salary/history
 * Get current employee's salary history
 */
router.get('/salary/history', EmployeeSelfServiceController.getSalaryHistory);

/**
 * GET /api/employee/attendance?month=YYYY-MM
 * Get current employee's attendance for a specific month
 */
router.get('/attendance', EmployeeSelfServiceController.getAttendance);

/**
 * GET /api/employee/salary/pdf?month=YYYY-MM
 * Download salary PDF for current employee (READ-ONLY from MonthlySalary)
 * Blocks download if salary is on HOLD
 */
router.get('/salary/pdf', EmployeeSelfServiceController.downloadSalaryPdf);

export default router;

