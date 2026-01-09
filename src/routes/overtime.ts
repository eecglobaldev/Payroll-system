/**
 * Overtime Routes
 * Route definitions for overtime toggle endpoints
 */

import express, { Router } from 'express';
import { OvertimeController } from '../controllers/OvertimeController.js';

const router: Router = express.Router();

/**
 * GET /api/overtime/:employeeCode/:month
 * Get overtime status for an employee for a specific month
 */
router.get('/:employeeCode/:month', OvertimeController.getOvertimeStatus);

/**
 * POST /api/overtime/:employeeCode/:month
 * Update overtime toggle for an employee for a specific month
 * Body: { isOvertimeEnabled: boolean }
 */
router.post('/:employeeCode/:month', OvertimeController.updateOvertimeStatus);

/**
 * GET /api/overtime/batch/:month?employeeCodes=code1,code2,code3
 * Get overtime status for multiple employees in a month
 */
router.get('/batch/:month', OvertimeController.getOvertimeStatusBatch);

export default router;

