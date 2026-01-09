/**
 * Employee Details Routes
 * RESTful API endpoints for employee HR and salary data
 * 
 * REPLACES: Excel-based employee data management
 * SECURITY: Protected by API key middleware
 */

import { Router } from 'express';
import { EmployeeDetailsController } from '../controllers/EmployeeDetailsController.js';

const router = Router();

/**
 * GET /api/employee-details
 * Get all active employees with details
 * Returns: Array of employees with combined data from Employees + EmployeeDetails tables
 */
router.get('/', EmployeeDetailsController.getAllActive);

/**
 * GET /api/employee-details/:employeeCode
 * Get specific employee details by employee code
 * Returns: Single employee with combined data
 */
router.get('/:employeeCode', EmployeeDetailsController.getByEmployeeCode);

/**
 * GET /api/employee-details/department/:department
 * Get employees by department
 * Returns: Array of employees in the specified department
 */
router.get('/department/:department', EmployeeDetailsController.getByDepartment);

/**
 * GET /api/employee-details/:employeeCode/salary-info
 * Get salary info for payroll calculation
 * Returns: { baseSalary, hourlyRate }
 */
router.get('/:employeeCode/salary-info', EmployeeDetailsController.getSalaryInfo);

/**
 * POST /api/employee-details
 * Create new employee details
 * Body: CreateEmployeeDetailsRequest
 * Returns: Created employee details
 */
router.post('/', EmployeeDetailsController.create);

/**
 * PUT /api/employee-details/:employeeCode
 * Update employee details
 * Body: UpdateEmployeeDetailsRequest
 * Returns: Updated employee details
 */
router.put('/:employeeCode', EmployeeDetailsController.update);

/**
 * POST /api/employee-details/:employeeCode/exit
 * Mark employee as exited
 * Body: { exitDate: string, updatedBy?: string }
 * Returns: Success message
 */
router.post('/:employeeCode/exit', EmployeeDetailsController.markAsExited);

export default router;

