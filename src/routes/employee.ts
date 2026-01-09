/**
 * Employee Routes
 * Route definitions for employee endpoints (reads from Excel)
 */

import express, { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController.js';

const router: Router = express.Router();

/**
 * GET /api/employees
 * Get all employees from Excel
 */
router.get('/', EmployeeController.getAllEmployees);

/**
 * GET /api/employees/search?name=xxx
 * Search employees by name
 */
router.get('/search', EmployeeController.searchByName);

/**
 * GET /api/employees/:employeeNo
 * Get employee by employee number
 */
router.get('/:employeeNo', EmployeeController.getByEmployeeNo);

/**
 * GET /api/employees/department/:department
 * Get employees by department
 */
router.get('/department/:department', EmployeeController.getByDepartment);

/**
 * POST /api/employees/reload
 * Reload salary data from Excel (clears cache)
 */
router.post('/reload', EmployeeController.reloadData);

export default router;

