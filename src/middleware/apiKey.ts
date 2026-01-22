/**
 * API Key Authentication Middleware
 * Validates x-api-key header against environment variable
 */

import { Request, Response, NextFunction } from 'express';

export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    console.error('[AUTH] API_KEY not configured in environment');
    res.status(500).json({
      error: 'Server configuration error',
      message: 'API authentication not properly configured',
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-api-key header',
    });
    return;
  }

  if (apiKey !== expectedApiKey) {
    console.warn('[AUTH] Invalid API key attempt from IP:', req.ip);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // API key is valid, proceed to next middleware
  next();
}

export default validateApiKey;

