/**
 * Holiday Model
 * Database operations for holiday management
 */

import { query } from '../db/pool.js';

export interface Holiday {
  HolidayId: number;
  HolidayDate: string; // YYYY-MM-DD
  HolidayName: string;
  Description: string | null;
  IsActive: boolean;
  CreatedAt: Date;
  CreatedBy: string | null;
  UpdatedAt: Date | null;
  UpdatedBy: string | null;
}

/** Raw row from PostgreSQL (lowercase column names) */
interface HolidayRow {
  holidayid?: number;
  holidaydate?: Date | string;
  holidayname?: string;
  description?: string | null;
  isactive?: boolean;
  createdat?: Date;
  createdby?: string | null;
  updatedat?: Date | null;
  updatedby?: string | null;
}

/** Format date as YYYY-MM-DD in local time (no UTC shift) */
function formatDateLocal(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapRow(row: HolidayRow): Holiday {
  return {
    HolidayId: row.holidayid ?? 0,
    HolidayDate: row.holidaydate ? formatDateLocal(row.holidaydate) : '',
    HolidayName: row.holidayname ?? '',
    Description: row.description ?? null,
    IsActive: row.isactive !== undefined ? row.isactive : true,
    CreatedAt: row.createdat ?? new Date(),
    CreatedBy: row.createdby ?? null,
    UpdatedAt: row.updatedat ?? null,
    UpdatedBy: row.updatedby ?? null,
  };
}

export class HolidayModel {
  /**
   * Get all active holidays
   * @param year Optional year filter (YYYY)
   */
  static async getAll(year?: number): Promise<Holiday[]> {
    try {
      let sqlQuery = `
        SELECT 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
        FROM holidays
        WHERE isactive = true
      `;

      const params: Record<string, string | number | null | undefined> = {};

      if (year) {
        sqlQuery += ` AND EXTRACT(YEAR FROM holidaydate) = @year`;
        params.year = year;
      }

      sqlQuery += ` ORDER BY holidaydate ASC`;

      const result = await query<HolidayRow>(sqlQuery, params);
      return result.recordset.map(mapRow);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error fetching holidays:', err.message);
      throw error;
    }
  }

  /**
   * Get holiday by ID
   */
  static async getById(id: number): Promise<Holiday | null> {
    try {
      const result = await query<HolidayRow>(`
        SELECT 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
        FROM holidays
        WHERE holidayid = @id
      `, { id });

      if (result.recordset.length === 0) {
        return null;
      }
      return mapRow(result.recordset[0]);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error fetching holiday by ID:', err.message);
      throw error;
    }
  }

  /**
   * Get holiday by date
   * @param date Date in YYYY-MM-DD format
   */
  static async getByDate(date: string): Promise<Holiday | null> {
    try {
      const result = await query<HolidayRow>(`
        SELECT 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
        FROM holidays
        WHERE holidaydate = @date
          AND isactive = true
      `, { date });

      if (result.recordset.length === 0) {
        return null;
      }
      return mapRow(result.recordset[0]);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error fetching holiday by date:', err.message);
      throw error;
    }
  }

  /**
   * Get holidays in a date range
   * @param start Start date in YYYY-MM-DD format
   * @param end End date in YYYY-MM-DD format
   */
  static async getByDateRange(start: string, end: string): Promise<Holiday[]> {
    try {
      const result = await query<HolidayRow>(`
        SELECT 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
        FROM holidays
        WHERE holidaydate >= @start
          AND holidaydate <= @end
          AND isactive = true
        ORDER BY holidaydate ASC
      `, { start, end });

      return result.recordset.map(mapRow);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error fetching holidays by date range:', err.message);
      throw error;
    }
  }

  /**
   * Create a new holiday
   */
  static async create(holiday: {
    date: string;
    name: string;
    description?: string;
    createdBy?: string;
  }): Promise<Holiday> {
    try {
      const result = await query<HolidayRow>(`
        INSERT INTO holidays (
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby
        )
        VALUES (
          @date,
          @name,
          @description,
          true,
          CURRENT_TIMESTAMP,
          @createdBy
        )
        RETURNING 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
      `, {
        date: holiday.date,
        name: holiday.name,
        description: holiday.description || null,
        createdBy: holiday.createdBy || null,
      });

      return mapRow(result.recordset[0]);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      // Check for unique constraint violation (duplicate date)
      if (err.code === '23505' || err.message?.includes('unique') || err.message?.includes('duplicate')) {
        throw new Error('A holiday already exists for this date');
      }
      console.error('[HolidayModel] Error creating holiday:', err.message);
      throw error;
    }
  }

  /**
   * Update a holiday
   */
  static async update(
    id: number,
    updates: {
      name?: string;
      description?: string;
      updatedBy?: string;
    }
  ): Promise<Holiday> {
    try {
      const updateFields: string[] = [];
      const params: Record<string, string | number | null | undefined> = { id };

      if (updates.name !== undefined) {
        updateFields.push('holidayname = @name');
        params.name = updates.name;
      }

      if (updates.description !== undefined) {
        updateFields.push('description = @description');
        params.description = updates.description;
      }

      if (updates.updatedBy !== undefined) {
        updateFields.push('updatedby = @updatedBy');
        params.updatedBy = updates.updatedBy;
      }

      if (updateFields.length === 0) {
        // No updates, just return existing
        const existing = await this.getById(id);
        if (!existing) {
          throw new Error('Holiday not found');
        }
        return existing;
      }

      updateFields.push('updatedat = CURRENT_TIMESTAMP');

      const result = await query<HolidayRow>(`
        UPDATE holidays
        SET ${updateFields.join(', ')}
        WHERE holidayid = @id
        RETURNING 
          holidayid,
          holidaydate,
          holidayname,
          description,
          isactive,
          createdat,
          createdby,
          updatedat,
          updatedby
      `, params);

      if (result.recordset.length === 0) {
        throw new Error('Holiday not found');
      }

      return mapRow(result.recordset[0]);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error updating holiday:', err.message);
      throw error;
    }
  }

  /**
   * Delete a holiday from the database (hard delete)
   */
  static async delete(id: number, _deletedBy?: string): Promise<void> {
    try {
      await query(`
        DELETE FROM holidays
        WHERE holidayid = @id
      `, { id });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HolidayModel] Error deleting holiday:', err.message);
      throw error;
    }
  }
}
