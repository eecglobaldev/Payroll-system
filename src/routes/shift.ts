/**
 * Shift Routes
 * Route definitions for shift endpoints
 */

import express, { Router } from 'express';
import { ShiftController } from '../controllers/ShiftController.js';

const router: Router = express.Router();

/**
 * GET /api/shifts
 * Get all shifts from Employee_Shifts table
 */
router.get('/', ShiftController.getAllShifts);

/**
 * GET /api/shifts/:shiftName
 * Get shift by name
 */
router.get('/:shiftName', ShiftController.getShiftByName);

export default router;

