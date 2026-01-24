/**
 * JWT Token Utilities
 * Generate and verify JWT tokens for employee authentication
 */

import jwt from 'jsonwebtoken';

interface JWTPayload {
  employeeCode: string;
  role: string;
  userId?: number;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  
  if (!secret || secret === 'your-secret-key-change-in-production') {
    console.warn('[JWT] Using default JWT_SECRET - not secure for production!');
  }
  
  return jwt.sign(payload, secret, { expiresIn: '24h' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    if (!secret || secret === 'your-secret-key-change-in-production') {
      console.warn('[JWT] Using default JWT_SECRET - not secure for production!');
    }
    
    console.log('[JWT] Verifying token, secret configured:', !!secret, 'Token length:', token.length);
    
    const decoded = jwt.verify(token, secret) as any;
    
    console.log('[JWT] Full decoded token payload:', JSON.stringify(decoded, null, 2));
    console.log('[JWT] Token verified successfully:', {
      employeeCode: decoded.employeeCode,
      role: decoded.role,
      userId: decoded.userId,
    });
    
    return {
      employeeCode: decoded.employeeCode,
      role: decoded.role,
      userId: decoded.userId,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[JWT] Token verification failed:', err.message);
    if (err.name === 'JsonWebTokenError') {
      console.error('[JWT] JWT Error details:', err.message);
    } else if (err.name === 'TokenExpiredError') {
      console.error('[JWT] Token expired at:', (err as any).expiredAt);
    }
    return null;
  }
}


