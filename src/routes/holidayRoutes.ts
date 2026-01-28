/**
 * Holiday Routes
 * Route definitions for holiday management endpoints
 * All routes require admin authentication (API key)
 */

import express, { Router } from 'express';
import { HolidayController } from '../controllers/HolidayController.js';

const router: Router = express.Router();

/**
 * GET /api/holidays
 * Get all active holidays (optionally filtered by year)
 * Query params: ?year=YYYY
 */
router.get('/', HolidayController.getAll);

/**
 * GET /api/holidays/range
 * Get holidays in a date range
 * Query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
router.get('/range', HolidayController.getByDateRange);

/**
 * GET /api/holidays/date/:date
 * Get holiday by date (YYYY-MM-DD)
 */
router.get('/date/:date', HolidayController.getByDate);

/**
 * GET /api/holidays/:id
 * Get holiday by ID
 */
router.get('/:id', HolidayController.getById);

/**
 * POST /api/holidays
 * Create a new holiday
 * Body: { date: string, name: string, description?: string }
 */
router.post('/', HolidayController.create);

/**
 * PUT /api/holidays/:id
 * Update a holiday (name and description only)
 * Body: { name?: string, description?: string }
 */
router.put('/:id', HolidayController.update);

/**
 * DELETE /api/holidays/:id
 * Soft delete a holiday
 */
router.delete('/:id', HolidayController.delete);

export default router;
