/**
 * Employee Controller
 * Handles employee-related requests
 * 
 * Data Sources:
 * - Employee names/codes: Employees table (database)
 * - Employee details (salary, HR data): EmployeeDetails table (database)
 * 
 * IMPORTANT: Excel is NO LONGER used for employee data
 */

import { Request, Response } from 'express';
import { EmployeeDetailsService } from '../services/employeeDetailsService.js';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';

export class EmployeeController {
  /**
   * Get all employees
   * Returns ALL employees from Employees table (DATABASE)
   * Merges with EmployeeDetails table for additional information
   * Shows all employees from Employees table, with details when available
   */
  static async getAllEmployees(_req: Request, res: Response): Promise<void> {
    try {
      // Fetch ALL employees from Employees table (no filtering)
      const employees = await EmployeeModel.getAllActive();
      
      // Fetch ALL employee details from EmployeeDetails table
      const allDetails = await EmployeeDetailsModel.getAll();
      
      // Create a map of details by EmployeeCode for quick lookup
      const detailsMap = new Map<string, any>();
      allDetails.forEach(detail => {
        // Use lowercase employeecode for matching (PostgreSQL returns lowercase)
        const code = detail.EmployeeCode || (detail as any).employeecode || '';
        if (code) {
          detailsMap.set(code, detail);
        }
      });
      
      console.log(`[EmployeeController] Loaded ${allDetails.length} EmployeeDetails records`);
      console.log(`[EmployeeController] Sample detail keys:`, allDetails.length > 0 ? Object.keys(allDetails[0]) : 'none');

      // Transform to match frontend format, merging with details when available
      // FILTER: Only include employees who have EmployeeDetails records
      const formattedEmployees = employees
        .filter(emp => {
          const hasCode = emp.EmployeeCode && emp.EmployeeCode.trim() !== '';
          if (!hasCode) {
            return false; // Skip employees without EmployeeCode
          }
          const details = detailsMap.get(emp.EmployeeCode);
          return details !== undefined; // Only include if EmployeeDetails exists
        })
        .map(emp => {
          const details = detailsMap.get(emp.EmployeeCode!); // Safe to use ! since we filtered above
          
          // Use EmployeeName from Employees table (should always be available)
          const employeeName = emp.EmployeeName || 'Unknown';
          
          // All these employees have EmployeeDetails, so we can safely use details
          return {
            employeeNo: emp.EmployeeCode || '',
            employeeId: emp.EmployeeId || null, // Add EmployeeId for salary calculations
            name: employeeName,
            department: details?.Department || 'N/A',
            designation: details?.Designation || 'N/A',
            fullBasic: details?.BasicSalary || 0,
            monthlyCTC: details?.MonthlyCTC || 0,
            annualCTC: details?.AnnualCTC || 0,
            joinDate: details?.JoiningDate || 'N/A',
            status: details ? (details.ExitDate === null ? 'Active' : 'Exited') : 'Active',
            location: details?.BranchLocation || 'N/A',
          };
        });

      console.log(`[EmployeeController] ✅ Loaded ${formattedEmployees.length} employees with EmployeeDetails (filtered from ${employees.length} total employees)`);
      console.log(`[EmployeeController] Total EmployeeDetails records: ${allDetails.length}`);

      res.json({
        success: true,
        count: formattedEmployees.length,
        data: formattedEmployees,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeController] Error fetching employees:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to load employee data',
        details: error.message,
      });
    }
  }

  /**
   * Get employee by employee number
   * Returns employee data from Employees + EmployeeDetails tables (DATABASE)
   */
  static async getByEmployeeNo(req: Request, res: Response): Promise<void> {
    try {
      const { employeeNo } = req.params;

      if (!employeeNo) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Employee number is required',
        });
        return;
      }

      // Get employee with details from database
      const employeeWithDetails = await EmployeeDetailsService.getEmployeeWithDetails(employeeNo);

      if (!employeeWithDetails) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Employee ${employeeNo} not found in database`,
        });
        return;
      }

      // Format response to match frontend expectations
      res.json({
        success: true,
        data: {
          employeeNo: employeeWithDetails.employeeNo,
          name: employeeWithDetails.name,
          department: employeeWithDetails.department || 'N/A',
          designation: employeeWithDetails.designation || 'N/A',
          fullBasic: employeeWithDetails.basicSalary || 0,
          monthlyCTC: employeeWithDetails.monthlyCTC || 0,
          annualCTC: employeeWithDetails.annualCTC || 0,
          joinDate: employeeWithDetails.joiningDate || 'N/A',
          status: employeeWithDetails.isActive ? 'Active' : 'Exited',
          location: employeeWithDetails.branchLocation || 'N/A',
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeController] Error fetching employee:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to load employee data',
        details: error.message,
      });
    }
  }

  /**
   * Search employees by name (searches DATABASE, not Excel)
   */
  static async searchByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.query as { name: string };

      if (!name) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Name parameter is required',
        });
        return;
      }

      // Get all active employees from database and filter by name
      const allEmployees = await EmployeeModel.getAllActive();
      const searchTerm = name.toLowerCase();
      
      const filteredEmployees = allEmployees.filter(emp => 
        emp.EmployeeName.toLowerCase().includes(searchTerm) ||
        emp.EmployeeCode.toLowerCase().includes(searchTerm)
      );

      // Transform to match frontend format
      const employees = filteredEmployees.map(emp => ({
        employeeNo: emp.EmployeeCode,
        name: emp.EmployeeName,
        department: emp.Department || 'N/A',
        designation: emp.Designation || 'N/A',
      }));

      res.json({
        success: true,
        count: employees.length,
        data: employees,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeController] Error searching employees:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to search employees',
        details: error.message,
      });
    }
  }

  /**
   * Get employees by department (from DATABASE)
   */
  static async getByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { department } = req.params;

      if (!department) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Department is required',
        });
        return;
      }

      // Fetch from EmployeeDetails service
      const employees = await EmployeeDetailsService.getEmployeesByDepartment(department);

      // Transform to match frontend format
      const formattedEmployees = employees.map(emp => ({
        employeeNo: emp.employeeNo,
        name: emp.name,
        department: emp.department || 'N/A',
        designation: emp.designation || 'N/A',
        fullBasic: emp.basicSalary || 0,
      }));

      res.json({
        success: true,
        department,
        count: formattedEmployees.length,
        data: formattedEmployees,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeController] Error fetching employees by department:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to load employees by department',
        details: error.message,
      });
    }
  }

  /**
   * Reload employee data (DEPRECATED - kept for backward compatibility)
   * Note: Data is now loaded from database, no reload needed
   */
  static async reloadData(_req: Request, res: Response): Promise<void> {
    try {
      // Get count of active employees from database
      const employees = await EmployeeDetailsService.getAllActiveEmployeesWithDetails();

      res.json({
        success: true,
        message: 'Employee data loaded from database (no reload needed)',
        employeesLoaded: employees.length,
        note: 'This endpoint is deprecated. Data is now stored in database.',
      });
    } catch (err) {
      const error = err as Error;
      console.error('[EmployeeController] Error loading data:', error);
      res.status(500).json({
        error: 'Database Error',
        message: 'Failed to load employee data',
        details: error.message,
      });
    }
  }
}

export default EmployeeController;

