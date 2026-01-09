/**
 * JWT Authentication Middleware
 * Verifies JWT token and extracts employee information
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      employeeCode?: string;
      userId?: number;
      role?: string;
    }
  }
}

/**
 * Middleware to verify JWT token
 * Extracts employeeCode from token and attaches to request
 */
export function verifyJWT(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const payload = verifyToken(token);
    
    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid or expired token',
      });
      return;
    }

    // Attach employee info to request
    req.employeeCode = payload.employeeCode;
    req.userId = payload.userId;
    req.role = payload.role;

    next();
  } catch (error) {
    console.error('[JWT Auth] Error verifying token:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Token verification failed',
    });
  }
}

