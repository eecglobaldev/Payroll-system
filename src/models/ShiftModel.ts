/**
 * Shift Model
 * Database interactions for shift timing data
 */

import { query } from '../db/pool.js';
import { Shift, ShiftTiming } from '../types/index.js';

export class ShiftModel {
  /**
   * Get shift by shift name
   * Returns null if not found
   */
  static async getByName(shiftName: string): Promise<Shift | null> {
    try {
      const sqlQuery = `
        SELECT 
          shiftid,
          shiftname,
          starttime,
          endtime,
          issplitshift,
          starttime_1,
          endtime_1,
          starttime_2,
          endtime_2,
          workhours,
          latethresholdminutes,
          createdat,
          updatedat
        FROM employee_shifts
        WHERE shiftname = @shiftName
      `;

      const result = await query<any>(sqlQuery, { shiftName });
      
      if (result.recordset.length === 0) {
        return null;
      }

      return this.mapToShift(result.recordset[0]);
    } catch (error: any) {
      console.error('[ShiftModel] Error fetching shift by name:', error.message);
      throw error;
    }
  }

  /**
   * Get all shifts
   */
  static async getAll(): Promise<Shift[]> {
    try {
      const sqlQuery = `
        SELECT 
          shiftid,
          shiftname,
          starttime,
          endtime,
          issplitshift,
          starttime_1,
          endtime_1,
          starttime_2,
          endtime_2,
          workhours,
          latethresholdminutes,
          createdat,
          updatedat
        FROM employee_shifts
        ORDER BY shiftname
      `;

      const result = await query<any>(sqlQuery, {});
      return result.recordset.map(row => this.mapToShift(row));
    } catch (error: any) {
      console.error('[ShiftModel] Error fetching all shifts:', error.message);
      throw error;
    }
  }

  /**
   * Get default shift (Shift D - 10 to 7) - fallback if employee has no shift assigned
   */
  static async getDefaultShift(): Promise<Shift | null> {
    // Try to get "D" shift first (10:00 - 19:00)
    const defaultShift = await this.getByName('D');
    if (defaultShift) {
      return defaultShift;
    }

    // If not found, try "10 to 7" (legacy name)
    const legacyShift = await this.getByName('10 to 7');
    if (legacyShift) {
      return legacyShift;
    }

    // If not found, get the first shift available
    const allShifts = await this.getAll();
    if (allShifts.length > 0) {
      console.warn('[ShiftModel] Default shift "D" not found, using first available shift');
      return allShifts[0];
    }

    return null;
  }

  /**
   * Parse shift timing for calculations
   * Converts TIME (Date object or string) to hour/minute numbers
   * Supports both normal shifts and split shifts
   */
  static parseShiftTiming(shift: Shift | null): ShiftTiming | null {
    if (!shift) {
      return null;
    }

    try {
      // Helper function to parse time value (Date or string) to hours and minutes
      const parseTime = (timeValue: any): { hour: number; minute: number } | null => {
        if (timeValue instanceof Date) {
          return {
            hour: timeValue.getUTCHours(),
            minute: timeValue.getUTCMinutes(),
          };
        } else if (typeof timeValue === 'string') {
          const parts = timeValue.split(':');
          return {
            hour: parseInt(parts[0], 10),
            minute: parseInt(parts[1], 10),
          };
        } else if (timeValue === null || timeValue === undefined) {
          return null;
        } else {
          console.error('[ShiftModel] Invalid time format:', typeof timeValue, timeValue);
          return null;
        }
      };

      // Check if this is a split shift
      if (shift.IsSplitShift) {
        // Parse split shift times
        const start1 = parseTime(shift.StartTime_1);
        const end1 = parseTime(shift.EndTime_1);
        const start2 = parseTime(shift.StartTime_2);
        const end2 = parseTime(shift.EndTime_2);

        if (!start1 || !end1 || !start2 || !end2) {
          console.error('[ShiftModel] Split shift has missing or invalid slot times');
          return null;
        }

        return {
          startHour: 0, // Not used for split shifts
          startMinute: 0,
          endHour: 0,
          endMinute: 0,
          workHours: shift.WorkHours,
          lateThresholdMinutes: shift.LateThresholdMinutes,
          isSplitShift: true,
          slot1: {
            startHour: start1.hour,
            startMinute: start1.minute,
            endHour: end1.hour,
            endMinute: end1.minute,
          },
          slot2: {
            startHour: start2.hour,
            startMinute: start2.minute,
            endHour: end2.hour,
            endMinute: end2.minute,
          },
        };
      } else {
        // Parse normal shift times
        const start = parseTime(shift.StartTime);
        const end = parseTime(shift.EndTime);

        if (!start || !end) {
          console.error('[ShiftModel] Normal shift has invalid start or end time');
          return null;
        }

        return {
          startHour: start.hour,
          startMinute: start.minute,
          endHour: end.hour,
          endMinute: end.minute,
          workHours: shift.WorkHours,
          lateThresholdMinutes: shift.LateThresholdMinutes,
          isSplitShift: false,
        };
      }
    } catch (error: any) {
      console.error('[ShiftModel] Error parsing shift timing:', error.message, error);
      return null;
    }
  }

  /**
   * Helper: Map database row to Shift interface
   */
  private static mapToShift(row: any): Shift {
    return {
      ShiftId: row.ShiftId,
      ShiftName: row.ShiftName,
      StartTime: row.StartTime, // TIME format from SQL Server
      EndTime: row.EndTime, // TIME format from SQL Server
      IsSplitShift: Boolean(row.IsSplitShift),
      StartTime_1: row.StartTime_1 || null,
      EndTime_1: row.EndTime_1 || null,
      StartTime_2: row.StartTime_2 || null,
      EndTime_2: row.EndTime_2 || null,
      WorkHours: parseFloat(row.WorkHours),
      LateThresholdMinutes: parseInt(row.LateThresholdMinutes, 10),
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
    };
  }
}

export default ShiftModel;

