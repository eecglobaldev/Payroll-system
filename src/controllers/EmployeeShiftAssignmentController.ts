/**
 * Employee Shift Assignment Controller
 * Handles date-wise shift assignment API requests
 */

import { Request, Response } from 'express';
import { EmployeeShiftAssignmentModel } from '../models/EmployeeShiftAssignmentModel.js';
import { ShiftModel } from '../models/ShiftModel.js';
import { CreateShiftAssignmentRequest } from '../types/index.js';

export class EmployeeShiftAssignmentController {
  /**
   * POST /api/employee-shifts/assign
   * Assign shift to employee for a date range
   * Body: { employeeCode, shiftName, fromDate, toDate }
   */
  static async assignShift(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, shiftName, fromDate, toDate } = req.body;

      // Validation
      if (!employeeCode || !shiftName || !fromDate || !toDate) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Missing required fields: employeeCode, shiftName, fromDate, toDate',
        });
        return;
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      // Validate date range
      if (fromDate > toDate) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'FromDate must be less than or equal to ToDate',
        });
        return;
      }

      // Validate shift exists
      const shift = await ShiftModel.getByName(shiftName);
      if (!shift) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Shift "${shiftName}" not found`,
        });
        return;
      }

      // Create assignment
      const assignment = await EmployeeShiftAssignmentModel.createAssignment({
        employeeCode,
        shiftName,
        fromDate,
        toDate,
      });

      res.status(201).json({
        success: true,
        data: assignment,
        message: `Shift "${shiftName}" assigned to employee ${employeeCode} from ${fromDate} to ${toDate}`,
      });
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentController] Error assigning shift:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to assign shift',
      });
    }
  }

  /**
   * GET /api/employee-shifts/:employeeCode
   * Get all shift assignments for an employee
   */
  static async getAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.params;
      const { startDate, endDate } = req.query;

      if (!employeeCode) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Employee code is required',
        });
        return;
      }

      let assignments;
      if (startDate && endDate) {
        // Get assignments within date range
        assignments = await EmployeeShiftAssignmentModel.getAssignmentsForEmployee(
          employeeCode,
          startDate as string,
          endDate as string
        );
      } else {
        // Get all assignments
        assignments = await EmployeeShiftAssignmentModel.getAllForEmployee(employeeCode);
      }

      res.json({
        success: true,
        data: assignments,
        message: `Retrieved ${assignments.length} shift assignment(s) for employee ${employeeCode}`,
      });
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentController] Error fetching assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch shift assignments',
      });
    }
  }

  /**
   * DELETE /api/employee-shifts/:id
   * Delete a shift assignment by ID
   */
  static async deleteAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Assignment ID is required',
        });
        return;
      }

      const assignmentId = parseInt(id, 10);
      if (isNaN(assignmentId)) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid assignment ID',
        });
        return;
      }

      const deleted = await EmployeeShiftAssignmentModel.deleteById(assignmentId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Shift assignment with ID ${assignmentId} not found`,
        });
        return;
      }

      res.json({
        success: true,
        message: `Shift assignment ${assignmentId} deleted successfully`,
      });
    } catch (error: any) {
      console.error('[EmployeeShiftAssignmentController] Error deleting assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to delete shift assignment',
      });
    }
  }
}

