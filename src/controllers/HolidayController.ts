/**
 * Holiday Controller
 * Handles holiday management endpoints
 * All endpoints require admin authentication (API key)
 */

import { Request, Response } from 'express';
import { HolidayModel } from '../models/HolidayModel.js';

export class HolidayController {
  /**
   * GET /api/holidays
   * Get all active holidays (optionally filtered by year)
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const yearParam = req.query.year as string | undefined;
      const year = yearParam ? parseInt(yearParam, 10) : undefined;

      if (yearParam && isNaN(year!)) {
        res.status(400).json({
          success: false,
          error: 'Invalid year parameter. Must be a number (YYYY)',
        });
        return;
      }

      const holidays = await HolidayModel.getAll(year);

      res.json({
        success: true,
        data: holidays,
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error getting holidays:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/holidays/:id
   * Get holiday by ID
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid holiday ID',
        });
        return;
      }

      const holiday = await HolidayModel.getById(id);

      if (!holiday) {
        res.status(404).json({
          success: false,
          error: 'Holiday not found',
        });
        return;
      }

      res.json({
        success: true,
        data: holiday,
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error getting holiday by ID:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/holidays/date/:date
   * Get holiday by date (YYYY-MM-DD)
   */
  static async getByDate(req: Request, res: Response): Promise<void> {
    try {
      const date = req.params.date;

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      const holiday = await HolidayModel.getByDate(date);

      res.json({
        success: true,
        data: holiday, // null if not found
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error getting holiday by date:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/holidays/range?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Get holidays in a date range
   */
  static async getByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const start = req.query.start as string;
      const end = req.query.end as string;

      if (!start || !end) {
        res.status(400).json({
          success: false,
          error: 'Missing required query parameters: start and end (YYYY-MM-DD)',
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(start) || !dateRegex.test(end)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      if (start > end) {
        res.status(400).json({
          success: false,
          error: 'Start date must be before or equal to end date',
        });
        return;
      }

      const holidays = await HolidayModel.getByDateRange(start, end);

      res.json({
        success: true,
        data: holidays,
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error getting holidays by range:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/holidays
   * Create a new holiday
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { date, name, description } = req.body;

      // Validation
      if (!date || !name) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: date and name',
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      // Validate date is valid
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date',
        });
        return;
      }

      // Check if holiday already exists for this date
      const existing = await HolidayModel.getByDate(date);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'A holiday already exists for this date',
        });
        return;
      }

      // Get admin username from request (if available)
      const createdBy = (req as any).adminUsername || (req as any).user?.username || null;

      const holiday = await HolidayModel.create({
        date,
        name: name.trim(),
        description: description?.trim() || undefined,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: holiday,
        message: 'Holiday created successfully',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error creating holiday:', err);

      // Handle duplicate date error
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        res.status(409).json({
          success: false,
          error: 'A holiday already exists for this date',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * PUT /api/holidays/:id
   * Update a holiday (name and description only, date cannot be changed)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid holiday ID',
        });
        return;
      }

      const { name, description } = req.body;

      // At least one field must be provided
      if (name === undefined && description === undefined) {
        res.status(400).json({
          success: false,
          error: 'At least one field (name or description) must be provided',
        });
        return;
      }

      // Get admin username from request (if available)
      const updatedBy = (req as any).adminUsername || (req as any).user?.username || null;

      const holiday = await HolidayModel.update(id, {
        name: name?.trim(),
        description: description?.trim(),
        updatedBy,
      });

      res.json({
        success: true,
        data: holiday,
        message: 'Holiday updated successfully',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error updating holiday:', err);

      if (err.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Holiday not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * DELETE /api/holidays/:id
   * Soft delete a holiday (set IsActive = false)
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid holiday ID',
        });
        return;
      }

      // Check if holiday exists
      const existing = await HolidayModel.getById(id);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Holiday not found',
        });
        return;
      }

      // Get admin username from request (if available)
      const deletedBy = (req as any).adminUsername || (req as any).user?.username || null;

      await HolidayModel.delete(id, deletedBy);

      res.json({
        success: true,
        message: 'Holiday deleted successfully',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[HolidayController] Error deleting holiday:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }
}
