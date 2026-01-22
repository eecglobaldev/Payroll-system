/**
 * Shift Controller
 * Handles shift-related API requests
 */

import { Request, Response } from 'express';
import { ShiftModel } from '../models/ShiftModel.js';

export class ShiftController {
  /**
   * GET /api/shifts
   * Get all shifts from Employee_Shifts table
   */
  static async getAllShifts(_req: Request, res: Response): Promise<void> {
    try {
      const shifts = await ShiftModel.getAll();
      
      res.json({
        success: true,
        data: shifts,
        message: `Retrieved ${shifts.length} shifts`,
      });
    } catch (error: any) {
      console.error('[ShiftController] Error fetching shifts:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch shifts',
      });
    }
  }

  /**
   * GET /api/shifts/:shiftName
   * Get shift by name
   */
  static async getShiftByName(req: Request, res: Response): Promise<void> {
    try {
      const { shiftName } = req.params;
      
      if (!shiftName) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Shift name is required',
        });
        return;
      }

      const shift = await ShiftModel.getByName(shiftName);
      
      if (!shift) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Shift "${shiftName}" not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: shift,
        message: 'Shift retrieved successfully',
      });
    } catch (error: any) {
      console.error('[ShiftController] Error fetching shift:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch shift',
      });
    }
  }
}

