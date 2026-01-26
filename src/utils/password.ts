/**
 * Password Utility Functions
 * Password hashing, validation, and strength checking
 */

import bcrypt from 'bcrypt';

// Bcrypt salt rounds (10-12 recommended for good balance of security and performance)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 * Rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - Optional: special character (recommended)
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Optional: Special character check (recommended but not required)
  // Uncomment if you want to require special characters
  // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Bcrypt hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    if (!password || password.trim().length === 0) {
      throw new Error('Password cannot be empty');
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    const err = error as Error;
    console.error('[Password Utils] Error hashing password:', err.message);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare a plain text password with a bcrypt hash
 * @param password - Plain text password
 * @param hash - Bcrypt hashed password
 * @returns Promise<boolean> - True if password matches hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) {
      return false;
    }

    const match = await bcrypt.compare(password, hash);
    return match;
  } catch (error) {
    const err = error as Error;
    console.error('[Password Utils] Error comparing password:', err.message);
    return false;
  }
}

/**
 * Get password strength indicator (for UI feedback)
 * Returns: 'weak' | 'medium' | 'strong'
 */
export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (!password) {
    return 'weak';
  }

  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

export default {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  getPasswordStrength,
};
