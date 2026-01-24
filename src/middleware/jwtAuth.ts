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
      console.warn('[JWT Auth] No authorization header or invalid format');
      res.status(401).json({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token || token.trim() === '') {
      console.warn('[JWT Auth] Empty token');
      res.status(401).json({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      return;
    }
    
    console.log('[JWT Auth] Verifying token, length:', token.length);
    const payload = verifyToken(token);
    
    if (!payload) {
      console.error('[JWT Auth] Token verification failed - invalid or expired');
      res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid or expired token',
      });
      return;
    }

    console.log('[JWT Auth] Token verified successfully for:', payload.employeeCode);
    
    // Attach employee info to request
    req.employeeCode = payload.employeeCode;
    req.userId = payload.userId;
    req.role = payload.role;

    next();
  } catch (error) {
    const err = error as Error;
    console.error('[JWT Auth] Error verifying token:', err.message, err.stack);
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Token verification failed',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

