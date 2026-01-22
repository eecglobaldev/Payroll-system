/**
 * EmployeeDetails Controller
 * Handles HTTP requests for employee HR and salary data
 * 
 * REPLACES: Excel-based employee data management
 * PURPOSE: RESTful API for employee details CRUD operations
 */

import { Request, Response } from 'express';
import { EmployeeDetailsService } from '../services/employeeDetailsService.js';
import { CreateEmployeeDetailsRequest, UpdateEmployeeDetailsRequest } from '../types/index.js';

export class EmployeeDetailsController {
  /**
   * GET /api/employee-details/:employeeCode
   * Get employee details by employee code
   */
  static async getByEmployeeCode(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      const employeeWithDetails = await EmployeeDetailsService.getEmployeeWithDetails(employeeCode);

      if (!employeeWithDetails) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Employee ${employeeCode} not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: employeeWithDetails,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error fetching employee:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch employee details',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/employee-details
   * Get all active employees with details
   */
  static async getAllActive(req: Request, res: Response): Promise<void> {
    try {
      const employees = await EmployeeDetailsService.getAllActiveEmployeesWithDetails();

      res.json({
        success: true,
        count: employees.length,
        data: employees,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error fetching all employees:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch employees',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/employee-details/department/:department
   * Get employees by department
   */
  static async getByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { department } = req.params;

      if (!department) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Department is required',
        });
        return;
      }

      const employees = await EmployeeDetailsService.getEmployeesByDepartment(department);

      res.json({
        success: true,
        department,
        count: employees.length,
        data: employees,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error fetching by department:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch employees by department',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/employee-details
   * Create new employee details
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateEmployeeDetailsRequest = req.body;

      // Validate input
      const validation = EmployeeDetailsService.validateEmployeeDetailsData(data);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid employee details data',
          errors: validation.errors,
        });
        return;
      }

      // Create employee details
      const details = await EmployeeDetailsService.createEmployeeDetails(data);

      res.status(201).json({
        success: true,
        message: 'Employee details created successfully',
        data: details,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error creating employee details:', error);
      
      // Check for specific error types
      if (error.message.includes('does not exist in Employees table')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
        return;
      }

      if (error.message.includes('already has details')) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to create employee details',
        details: error.message,
      });
    }
  }

  /**
   * PUT /api/employee-details/:employeeCode
   * Update employee details
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const data: UpdateEmployeeDetailsRequest = req.body;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      // Update employee details
      const details = await EmployeeDetailsService.updateEmployeeDetails(employeeCode, data);

      res.json({
        success: true,
        message: 'Employee details updated successfully',
        data: details,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error updating employee details:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to update employee details',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/employee-details/:employeeCode/exit
   * Mark employee as exited
   */
  static async markAsExited(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const { exitDate, updatedBy } = req.body;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      if (!exitDate) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Exit date is required',
        });
        return;
      }

      await EmployeeDetailsService.markEmployeeAsExited(employeeCode, exitDate, updatedBy);

      res.json({
        success: true,
        message: `Employee ${employeeCode} marked as exited on ${exitDate}`,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error marking employee as exited:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to mark employee as exited',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/employee-details/:employeeCode/salary-info
   * Get salary info for payroll calculation
   */
  static async getSalaryInfo(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Employee code is required',
        });
        return;
      }

      const salaryInfo = await EmployeeDetailsService.getSalaryInfo(employeeCode);

      res.json({
        success: true,
        data: salaryInfo,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeDetailsController] Error fetching salary info:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to fetch salary info',
        details: error.message,
      });
    }
  }
}

export default EmployeeDetailsController;

