/**
 * Employee Shift Assignment Routes
 * Route definitions for date-wise shift assignment endpoints
 */

import express, { Router } from 'express';
import { EmployeeShiftAssignmentController } from '../controllers/EmployeeShiftAssignmentController.js';

const router: Router = express.Router();

/**
 * POST /api/employee-shifts/assign
 * Assign shift to employee for a date range
 * Body: { employeeCode, shiftName, fromDate, toDate }
 */
router.post('/assign', EmployeeShiftAssignmentController.assignShift);

/**
 * GET /api/employee-shifts/:employeeCode
 * Get shift assignments for an employee
 * Query params (optional): startDate, endDate
 */
router.get('/:employeeCode', EmployeeShiftAssignmentController.getAssignments);

/**
 * DELETE /api/employee-shifts/:id
 * Delete a shift assignment by ID
 */
router.delete('/:id', EmployeeShiftAssignmentController.deleteAssignment);

export default router;

