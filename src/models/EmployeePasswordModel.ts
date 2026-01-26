/**
 * Employee Password Model
 * Database interactions for employee password management
 */

import { query } from '../db/pool.js';
import { hashPassword, comparePassword } from '../utils/password.js';

/**
 * Employee Password interface
 */
export interface EmployeePassword {
  id: number;
  employeecode: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  last_password_change: Date;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
}

/**
 * Account lockout configuration
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export class EmployeePasswordModel {
  /**
   * Map database row to EmployeePassword interface
   * Handles both lowercase (PostgreSQL default) and PascalCase column names
   */
  private static mapToEmployeePassword(row: any): EmployeePassword {
    // Handle boolean fields
    let isActive = false;
    if (row.is_active !== undefined && row.is_active !== null) {
      if (typeof row.is_active === 'boolean') {
        isActive = row.is_active;
      } else if (typeof row.is_active === 'string') {
        isActive = row.is_active === '1' || row.is_active.toLowerCase() === 'true';
      } else if (typeof row.is_active === 'number') {
        isActive = row.is_active === 1;
      }
    }

    return {
      id: row.id || row.Id || row.ID,
      employeecode: row.employeecode || row.EmployeeCode || row.employeeCode || row.EMPLOYEECODE || '',
      password_hash: row.password_hash || row.PasswordHash || row.passwordHash || row.PASSWORD_HASH || '',
      created_at: row.created_at || row.CreatedAt || row.createdAt || new Date(),
      updated_at: row.updated_at || row.UpdatedAt || row.updatedAt || new Date(),
      last_password_change: row.last_password_change || row.LastPasswordChange || row.lastPasswordChange || new Date(),
      is_active: isActive,
      failed_login_attempts: row.failed_login_attempts || row.FailedLoginAttempts || row.failedLoginAttempts || 0,
      locked_until: row.locked_until || row.LockedUntil || row.lockedUntil || null,
    };
  }

  /**
   * Check if employee has a password set
   * @param employeeCode - Employee code
   * @returns Promise<boolean> - True if password exists
   */
  static async hasPassword(employeeCode: string): Promise<boolean> {
    const sqlQuery = `
      SELECT id
      FROM employee_passwords
      WHERE employeecode = @employeeCode
        AND is_active = true
    `;

    try {
      const result = await query<any>(sqlQuery, { employeeCode });
      return result.recordset.length > 0;
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error checking password existence:', err);
      throw err;
    }
  }

  /**
   * Get employee password record
   * @param employeeCode - Employee code
   * @returns Promise<EmployeePassword | null>
   */
  static async getByEmployeeCode(employeeCode: string): Promise<EmployeePassword | null> {
    const sqlQuery = `
      SELECT 
        id,
        employeecode,
        password_hash,
        created_at,
        updated_at,
        last_password_change,
        is_active,
        failed_login_attempts,
        locked_until
      FROM employee_passwords
      WHERE employeecode = @employeeCode
    `;

    try {
      const result = await query<any>(sqlQuery, { employeeCode });
      if (result.recordset.length === 0) {
        return null;
      }
      return this.mapToEmployeePassword(result.recordset[0]);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error fetching password:', err);
      throw err;
    }
  }

  /**
   * Create a new password for an employee
   * @param employeeCode - Employee code
   * @param password - Plain text password (will be hashed)
   * @returns Promise<void>
   */
  static async createPassword(employeeCode: string, password: string): Promise<void> {
    // Hash the password
    const passwordHash = await hashPassword(password);

    const sqlQuery = `
      INSERT INTO employee_passwords (
        employeecode,
        password_hash,
        created_at,
        updated_at,
        last_password_change,
        is_active,
        failed_login_attempts,
        locked_until
      )
      VALUES (
        @employeeCode,
        @passwordHash,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        true,
        0,
        NULL
      )
      ON CONFLICT (employeecode) 
      DO UPDATE SET
        password_hash = @passwordHash,
        updated_at = CURRENT_TIMESTAMP,
        last_password_change = CURRENT_TIMESTAMP,
        failed_login_attempts = 0,
        locked_until = NULL,
        is_active = true
    `;

    try {
      await query(sqlQuery, { employeeCode, passwordHash });
      console.log(`[EmployeePasswordModel] ✅ Password created/updated for employee: ${employeeCode}`);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error creating password:', err);
      throw new Error(`Failed to create password: ${err.message}`);
    }
  }

  /**
   * Verify employee password
   * @param employeeCode - Employee code
   * @param password - Plain text password to verify
   * @returns Promise<boolean> - True if password matches
   */
  static async verifyPassword(employeeCode: string, password: string): Promise<boolean> {
    const passwordRecord = await this.getByEmployeeCode(employeeCode);

    if (!passwordRecord) {
      return false;
    }

    if (!passwordRecord.is_active) {
      return false;
    }

    // Check if account is locked
    if (passwordRecord.locked_until) {
      const now = new Date();
      const lockedUntil = new Date(passwordRecord.locked_until);
      if (now < lockedUntil) {
        // Account is still locked
        return false;
      } else {
        // Lockout period expired, unlock the account
        await this.unlockAccount(employeeCode);
      }
    }

    // Compare password
    const match = await comparePassword(password, passwordRecord.password_hash);

    if (match) {
      // Reset failed attempts on successful login
      await this.resetFailedAttempts(employeeCode);
      return true;
    } else {
      // Increment failed attempts
      await this.incrementFailedAttempts(employeeCode);
      return false;
    }
  }

  /**
   * Update employee password
   * @param employeeCode - Employee code
   * @param newPassword - New plain text password (will be hashed)
   * @returns Promise<void>
   */
  static async updatePassword(employeeCode: string, newPassword: string): Promise<void> {
    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        password_hash = @passwordHash,
        updated_at = CURRENT_TIMESTAMP,
        last_password_change = CURRENT_TIMESTAMP,
        failed_login_attempts = 0,
        locked_until = NULL
      WHERE employeecode = @employeeCode
    `;

    try {
      const result = await query(sqlQuery, { employeeCode, passwordHash });
      if (result.rowsAffected[0] === 0) {
        throw new Error(`Password record not found for employee: ${employeeCode}`);
      }
      console.log(`[EmployeePasswordModel] ✅ Password updated for employee: ${employeeCode}`);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error updating password:', err);
      throw new Error(`Failed to update password: ${err.message}`);
    }
  }

  /**
   * Increment failed login attempts
   * @param employeeCode - Employee code
   * @returns Promise<void>
   */
  static async incrementFailedAttempts(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
      RETURNING failed_login_attempts
    `;

    try {
      const result = await query<any>(sqlQuery, { employeeCode });
      
      if (result.recordset.length > 0) {
        const attempts = result.recordset[0].failed_login_attempts || result.recordset[0].failed_login_attempts || 0;
        
        // Lock account if max attempts reached
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await this.lockAccount(employeeCode, LOCKOUT_DURATION_MINUTES);
          console.log(`[EmployeePasswordModel] 🔒 Account locked for employee: ${employeeCode} (${attempts} failed attempts)`);
        } else {
          console.log(`[EmployeePasswordModel] ⚠️ Failed login attempt for employee: ${employeeCode} (${attempts}/${MAX_FAILED_ATTEMPTS})`);
        }
      }
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error incrementing failed attempts:', err);
      throw err;
    }
  }

  /**
   * Reset failed login attempts (on successful login)
   * @param employeeCode - Employee code
   * @returns Promise<void>
   */
  static async resetFailedAttempts(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        failed_login_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    try {
      await query(sqlQuery, { employeeCode });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error resetting failed attempts:', err);
      throw err;
    }
  }

  /**
   * Check if account is locked
   * @param employeeCode - Employee code
   * @returns Promise<boolean> - True if account is locked
   */
  static async isAccountLocked(employeeCode: string): Promise<boolean> {
    const passwordRecord = await this.getByEmployeeCode(employeeCode);

    if (!passwordRecord || !passwordRecord.locked_until) {
      return false;
    }

    const now = new Date();
    const lockedUntil = new Date(passwordRecord.locked_until);

    if (now < lockedUntil) {
      return true;
    } else {
      // Lockout period expired, unlock the account
      await this.unlockAccount(employeeCode);
      return false;
    }
  }

  /**
   * Lock account for specified duration
   * @param employeeCode - Employee code
   * @param durationMinutes - Lockout duration in minutes
   * @returns Promise<void>
   */
  static async lockAccount(employeeCode: string, durationMinutes: number = LOCKOUT_DURATION_MINUTES): Promise<void> {
    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        locked_until = CURRENT_TIMESTAMP + INTERVAL '${durationMinutes} minutes',
        updated_at = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    try {
      await query(sqlQuery, { employeeCode });
      console.log(`[EmployeePasswordModel] 🔒 Account locked for employee: ${employeeCode} (${durationMinutes} minutes)`);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error locking account:', err);
      throw err;
    }
  }

  /**
   * Unlock account
   * @param employeeCode - Employee code
   * @returns Promise<void>
   */
  static async unlockAccount(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        locked_until = NULL,
        failed_login_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    try {
      await query(sqlQuery, { employeeCode });
      console.log(`[EmployeePasswordModel] 🔓 Account unlocked for employee: ${employeeCode}`);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error unlocking account:', err);
      throw err;
    }
  }

  /**
   * Deactivate password (soft delete)
   * @param employeeCode - Employee code
   * @returns Promise<void>
   */
  static async deactivate(employeeCode: string): Promise<void> {
    const sqlQuery = `
      UPDATE employee_passwords
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE employeecode = @employeeCode
    `;

    try {
      await query(sqlQuery, { employeeCode });
      console.log(`[EmployeePasswordModel] ✅ Password deactivated for employee: ${employeeCode}`);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeePasswordModel] Error deactivating password:', err);
      throw err;
    }
  }

  /**
   * Get lockout information
   * @param employeeCode - Employee code
   * @returns Promise<{ isLocked: boolean; lockedUntil: Date | null; attemptsRemaining: number }>
   */
  static async getLockoutInfo(employeeCode: string): Promise<{
    isLocked: boolean;
    lockedUntil: Date | null;
    attemptsRemaining: number;
  }> {
    const passwordRecord = await this.getByEmployeeCode(employeeCode);

    if (!passwordRecord) {
      return {
        isLocked: false,
        lockedUntil: null,
        attemptsRemaining: MAX_FAILED_ATTEMPTS,
      };
    }

    const isLocked = await this.isAccountLocked(employeeCode);
    const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - passwordRecord.failed_login_attempts);

    return {
      isLocked,
      lockedUntil: passwordRecord.locked_until,
      attemptsRemaining,
    };
  }
}
