/**
 * Admin User Model
 * Database interactions for admin user data
 */

import { query } from '../db/pool.js';

export interface AdminUser {
  id: number;
  username: string;
  password: string;
  created_at: Date | null;
  updated_at: Date | null;
  is_active: boolean;
  last_login: Date | null;
}

export class AdminUserModel {
  /**
   * Map database row to AdminUser interface
   * Handles both lowercase (PostgreSQL default) and PascalCase column names
   */
  private static mapToAdminUser(row: any): AdminUser {
    // Handle is_active as bit type (can be '1', '0', true, false, or 1, 0)
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
      id: row.id || row.Id,
      username: row.username || row.Username,
      password: row.password || row.Password,
      created_at: row.created_at || row.CreatedAt || row.createdAt || null,
      updated_at: row.updated_at || row.UpdatedAt || row.updatedAt || null,
      is_active: isActive,
      last_login: row.last_login || row.LastLogin || row.lastLogin || null,
    };
  }

  /**
   * Get admin user by username
   */
  static async getByUsername(username: string): Promise<AdminUser | null> {
    const sqlQuery = `
      SELECT 
        id,
        username,
        password,
        created_at,
        updated_at,
        is_active,
        last_login
      FROM admin_users
      WHERE LOWER(username) = LOWER(@username) AND is_active::TEXT = '1'
    `;

    try {
      const result = await query<any>(sqlQuery, { username });
      if (result.recordset.length === 0) {
        return null;
      }
      return this.mapToAdminUser(result.recordset[0]);
    } catch (error) {
      const err = error as Error;
      console.error('[AdminUserModel] Error fetching admin by username:', err);
      throw err;
    }
  }

  /**
   * Verify admin credentials
   */
  static async verifyCredentials(username: string, password: string): Promise<AdminUser | null> {
    const admin = await this.getByUsername(username);
    
    if (!admin) {
      return null;
    }

    // Compare plain text passwords (as per the example code)
    if (admin.password === password) {
      // Update last login
      await this.updateLastLogin(admin.id);
      return admin;
    }

    return null;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(adminId: number): Promise<void> {
    const sqlQuery = `
      UPDATE admin_users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = @adminId
    `;

    try {
      await query(sqlQuery, { adminId });
    } catch (error) {
      const err = error as Error;
      console.error('[AdminUserModel] Error updating last login:', err);
      throw err;
    }
  }

  /**
   * Create a new admin user
   */
  static async create(username: string, password: string): Promise<AdminUser> {
    const sqlQuery = `
      INSERT INTO admin_users (username, password, is_active, created_at, updated_at)
      VALUES (@username, @password, '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, password, created_at, updated_at, is_active, last_login
    `;

    try {
      const result = await query<AdminUser>(sqlQuery, { username, password });
      if (result.recordset.length === 0) {
        throw new Error('Failed to create admin user');
      }
      return this.mapToAdminUser(result.recordset[0]);
    } catch (error) {
      const err = error as Error;
      console.error('[AdminUserModel] Error creating admin user:', err);
      throw err;
    }
  }

  /**
   * Get all admin users
   */
  static async getAll(): Promise<AdminUser[]> {
    const sqlQuery = `
      SELECT 
        id,
        username,
        password,
        created_at,
        updated_at,
        is_active,
        last_login
      FROM admin_users
      ORDER BY created_at DESC
    `;

    try {
      const result = await query<AdminUser>(sqlQuery);
      return result.recordset.map(row => this.mapToAdminUser(row));
    } catch (error) {
      const err = error as Error;
      console.error('[AdminUserModel] Error fetching all admin users:', err);
      throw err;
    }
  }
}
