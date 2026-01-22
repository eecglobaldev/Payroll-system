/**
 * JWT Token Utilities
 * Generate and verify JWT tokens for employee authentication
 */

interface JWTPayload {
  employeeCode: string;
  role: string;
  userId?: number;
}

/**
 * Generate JWT token
 * Note: For production, use a proper JWT library like 'jsonwebtoken'
 * This is a simplified version for demonstration
 */
export function generateToken(payload: JWTPayload): string {
  // In production, use: import jwt from 'jsonwebtoken';
  // return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' });
  
  // For now, create a simple token (replace with proper JWT in production)
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
  };

  // Simple base64 encoding (NOT secure - use proper JWT library in production)
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  // In production, use HMAC-SHA256 for signature
  const signature = Buffer.from(`${encodedHeader}.${encodedPayload}.${secret}`).toString('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    // In production, use: import jwt from 'jsonwebtoken';
    // return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      employeeCode: payload.employeeCode,
      role: payload.role,
      userId: payload.userId,
    };
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}


