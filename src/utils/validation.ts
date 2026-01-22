/**
 * Input Validation Utilities using Joi
 */

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationResult } from '../types/index.js';

/**
 * Validation schemas for common inputs
 */
export const schemas = {
  // Date validation (YYYY-MM-DD)
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  
  // Month validation (YYYY-MM)
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  
  // Employee code validation
  employeeCode: Joi.string().min(1).max(50).required(),
  
  // Limit validation
  limit: Joi.number().integer().min(1).max(1000).default(100),
  
  // Date range validation
  dateRange: Joi.object({
    start: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    end: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  }),
};

/**
 * Validate query parameters
 */
export function validate<T = any>(
  data: any,
  schema: Joi.ObjectSchema | Joi.StringSchema | Joi.NumberSchema
): ValidationResult<T> {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true, // Enable type conversion and default application
  });
  
  if (error) {
    const messages = error.details.map(detail => detail.message).join(', ');
    return { error: messages, value: null };
  }
  
  return { error: null, value };
}

/**
 * Express middleware factory for validation
 * @param schema - Joi schema
 * @param source - 'query', 'params', or 'body'
 */
export function validateRequest(
  schema: Joi.ObjectSchema,
  source: 'query' | 'params' | 'body' = 'query'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[source];
    const { error, value } = validate(data, schema);
    
    if (error) {
      res.status(400).json({
        error: 'Validation Error',
        message: error,
      });
      return;
    }
    
    // Replace request data with validated and sanitized values
    (req as any)[source] = value;
    next();
  };
}

export { Joi };

