/**
 * Payroll Service
 * Business logic for salary calculation, working hours, and deductions
 */

import { calculateHours, getMonthRange, formatDate, createLocalDate } from '../utils/date.js';
import {
  AttendanceLog,
  DayHours,
  DailyBreakdown,
  MonthlyAttendance,
  SalaryCalculation,
  BaseSalaryInfo,
  PayrollConfig,
  ShiftTiming,
  LeaveDateWithValue,
} from '../types/index.js';
import { parseISO, getDay, eachDayOfInterval } from 'date-fns';

/**
 * Configuration from environment variables
 */
export const config: PayrollConfig = {
  defaultWorkHoursPerDay: parseFloat(process.env.DEFAULT_WORK_HOURS_PER_DAY || '8'),
  lateEntryThresholdMinutes: parseInt(process.env.LATE_ENTRY_THRESHOLD_MINUTES || '15', 10),
  earlyExitThresholdMinutes: parseInt(process.env.EARLY_EXIT_THRESHOLD_MINUTES || '30', 10),
  overtimeRateMultiplier: parseFloat(process.env.OVERTIME_RATE_MULTIPLIER || '1.5'),
  halfDayHoursThreshold: parseFloat(process.env.HALF_DAY_HOURS_THRESHOLD || '5'),
};

/**
 * Parse timestamp as local time, handling both SQL Server and PostgreSQL
 * 
 * SQL Server: datetime is stored as local time (no timezone), retrieved with 'Z' suffix
 * PostgreSQL: timestamp without time zone is returned as Date where UTC components = stored value
 * 
 * This function extracts the original time components without timezone conversion.
 */
function parseAsLocalTime(timestamp: Date | string): Date {
  // If already a Date object (from PostgreSQL pg library)
  // For timestamp without time zone, pg returns Date where UTC components = stored value
  // So we extract UTC components and create a new Date in local timezone
  if (timestamp instanceof Date) {
    const d = timestamp as Date;
    // PostgreSQL: UTC components represent the stored value (no timezone conversion)
    // Extract and create Date in local timezone to preserve the original time
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    );
  }
  
  const timestampStr = String(timestamp);
  
  // If string has 'Z' suffix (SQL Server format), parse components manually
  if (timestampStr.endsWith('Z')) {
    const match = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z?$/);
    
    if (match) {
      const [, year, month, day, hour, minute, second, ms] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(ms || '0')
      );
    }
  }
  
  // Try to parse as ISO string without timezone
  const isoMatch = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second, ms] = isoMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
      parseInt(ms || '0')
    );
  }
  
  return new Date(timestamp);
}

/**
 * Expected work timings (can be fetched from DB based on employee/shift)
 */
export const defaultShift = {
  startTime: '10:00:00',
  endTime: '19:00:00', // 10 AM to 7 PM
  workHours: 9,
  lunchBreakHours: 0,
};

/**
 * Get attendance records for an employee in a given month
 */
export async function getMonthlyAttendance(
  userId: number | string,
  month: string
): Promise<AttendanceLog[]> {
  // getMonthRange uses the 26th-25th salary cycle
  const { start, end } = getMonthRange(month);
  
  // Use AttendanceModel which handles dynamic table names
  // userid in devicelogs is VARCHAR (string), so convert userId to string
  const { AttendanceModel } = await import('../models/AttendanceModel.js');
  const logs = await AttendanceModel.getByEmployeeAndDateRange(String(userId), start, end);
  
  return logs;
}

/**
 * Calculate attendance for an arbitrary date range (e.g. "after 25th": 26th of month to today).
 * Used by employee self-service to show attendance after the payroll cycle end.
 */
export async function calculateAttendanceForDateRange(
  userId: number | string,
  start: string,
  end: string,
  joinDateStr?: string,
  exitDateStr?: string
): Promise<{ dailyBreakdown: DailyBreakdown[]; fullDays: number; halfDays: number; absentDays: number; lateDays: number; earlyExits: number; totalWorkedHours: number }> {
  const { AttendanceModel } = await import('../models/AttendanceModel.js');
  const userIdStr = String(userId);
  const logs = await AttendanceModel.getByEmployeeAndDateRange(userIdStr, start, end);
  const groupedLogs = groupByDate(logs);

  let shiftAssignments: any[] = [];
  let employeeDetails: any = null;
  try {
    const { EmployeeShiftAssignmentModel } = await import('../models/EmployeeShiftAssignmentModel.js');
    const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
    shiftAssignments = await EmployeeShiftAssignmentModel.getAssignmentsForEmployee(userIdStr, start, end);
    employeeDetails = await EmployeeDetailsModel.getByCode(userIdStr);
  } catch (err: any) {
    console.warn(`[Payroll] calculateAttendanceForDateRange: could not pre-fetch shifts/details: ${err.message}`);
  }

  const effectiveStart = joinDateStr && joinDateStr > start ? joinDateStr : start;
  const effectiveEnd = exitDateStr && exitDateStr < end ? exitDateStr : end;
  const startDate = createLocalDate(start);
  const endDate = createLocalDate(end);
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const dailyBreakdown: DailyBreakdown[] = [];
  let fullDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let earlyExits = 0;
  let totalWorkedHours = 0;

  const currentDate = new Date(startDate);
  for (let d = 0; d < totalDays; d++) {
    const dateStr = formatDate(currentDate);
    const isWithinEffectiveRange = dateStr >= effectiveStart && dateStr <= effectiveEnd;
    const dayShiftTiming = await resolveShiftForDate(userIdStr, dateStr, shiftAssignments, employeeDetails);
    const dayLogs = isWithinEffectiveRange ? (groupedLogs[dateStr] || []) : [];
    const dayStats = calculateDayHours(dayLogs, dayShiftTiming);

    if (!isWithinEffectiveRange) {
      (dayStats as any).status = 'not-active';
    }

    dailyBreakdown.push({ date: dateStr, ...dayStats });

    if (isWithinEffectiveRange) {
      const isSunday = getDay(currentDate) === 0;
      if (!isSunday) {
        totalWorkedHours += dayStats.totalHours;
        if (dayStats.status === 'full-day') fullDays++;
        if (dayStats.status === 'half-day') halfDays++;
        if (dayStats.status === 'absent') absentDays++;
        if (dayStats.isLate && (dayStats.status === 'full-day' || dayStats.status === 'half-day')) lateDays++;
        if (dayStats.isEarlyExit) earlyExits++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  try {
    const { AttendanceRegularizationModel } = await import('../models/AttendanceRegularizationModel.js');
    const regularizations = await AttendanceRegularizationModel.getRegularizationsByDateRange(userIdStr, start, end);
    for (const reg of regularizations) {
      const regDateStr = formatDate(new Date(reg.RegularizationDate));
      const dayEntry = dailyBreakdown.find((x: any) => x.date === regDateStr);
      if (dayEntry) {
        const originalStatus = dayEntry.status;
        const regularizedStatus = reg.RegularizedStatus || 'full-day';
        (dayEntry as any).originalStatus = originalStatus;
        (dayEntry as any).isRegularized = true;
        dayEntry.status = regularizedStatus as 'half-day' | 'full-day';
        if (originalStatus === 'absent') absentDays--;
        else if (originalStatus === 'half-day') halfDays--;
        if (regularizedStatus === 'full-day') fullDays++;
        else if (regularizedStatus === 'half-day') halfDays++;
        if (dayEntry.isLate && (originalStatus === 'absent' || originalStatus === 'half-day')) lateDays--;
      }
    }
  } catch (_) {}

  return {
    dailyBreakdown,
    fullDays,
    halfDays,
    absentDays,
    lateDays,
    earlyExits,
    totalWorkedHours,
  };
}

/**
 * Group attendance logs by date
 */
export function groupByDate(logs: AttendanceLog[]): Record<string, AttendanceLog[]> {
  const grouped: Record<string, AttendanceLog[]> = {};

  // Sort logs by timestamp (using local time)
  const sortedLogs = [...logs].sort((a, b) => 
    parseAsLocalTime(a.LogDate).getTime() - parseAsLocalTime(b.LogDate).getTime()
  );

  let i = 0;
  while (i < sortedLogs.length) {
    const currentLog = sortedLogs[i];
    const currentTime = parseAsLocalTime(currentLog.LogDate);
    const currentHour = currentTime.getHours();
    
    // Determine the workday date:
    // If time is between 00:00-05:00 (midnight to 5 AM), it's likely a checkout from previous day
    // Otherwise, it's the actual workday
    let workdayDate: Date;
    if (currentHour >= 0 && currentHour < 5) {
      // After midnight - belongs to previous day's shift
      workdayDate = new Date(currentTime);
      workdayDate.setDate(workdayDate.getDate() - 1);
    } else {
      // Normal hours - use current date
      workdayDate = currentTime;
    }
    
    const dateKey = formatDate(workdayDate);
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(currentLog);
    
    i++;
  }

  return grouped;
}

/**
 * Calculate working hours for a single day
 * Supports both normal shifts and split shifts
 * @param dayLogs - Attendance logs for the day
 * @param shiftTiming - Optional shift timing. If not provided, uses default 10:00 AM - 7:00 PM
 */
export function calculateDayHours(dayLogs: AttendanceLog[], shiftTiming?: ShiftTiming | null): DayHours {
  if (!dayLogs || dayLogs.length === 0) {
    return {
      firstEntry: null,
      lastExit: null,
      totalHours: 0,
      isLate: false,
      isLateBy30Minutes: false,
      minutesLate: null,
      isEarlyExit: false,
      status: 'absent',
      logCount: 0,
    };
  }

  // Get shift timing (default to 10:00 AM - 7:00 PM if not provided)
  const shift = shiftTiming || {
    startHour: 10,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    workHours: 9,
    lateThresholdMinutes: 12, // Late threshold: 10:12 AM (12 minutes after 10:00 AM)
    isSplitShift: false,
  };

  // Check if this is a split shift
  if (shift.isSplitShift && shift.slot1 && shift.slot2) {
    return calculateSplitShiftHours(dayLogs, shift);
  } else {
    return calculateNormalShiftHours(dayLogs, shift);
  }
}

/**
 * Format timestamp directly from PostgreSQL Date object
 * PostgreSQL timestamp without time zone returns Date where UTC components = stored value
 * This function extracts UTC components directly to preserve database time
 */
/**
 * Format timestamp from PostgreSQL TO_CHAR result or Date object
 * PostgreSQL TO_CHAR returns string like '2026-01-01T10:10:25.000' (no timezone)
 * This preserves the exact database time without any conversion
 */
function formatFromOriginalDate(originalDate: Date | string): string | null {
  if (!originalDate) return null;
  
  // If it's already a string from TO_CHAR, use it directly (no conversion needed)
  if (typeof originalDate === 'string') {
    // PostgreSQL TO_CHAR format: 'YYYY-MM-DDTHH24:MI:SS.MS'
    // Ensure it has milliseconds (pad if needed)
    const match = originalDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
    if (match) {
      const [, year, month, day, hour, minute, second, ms] = match;
      const milliseconds = ms ? ms.padEnd(3, '0') : '000';
      return `${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}`;
    }
    // If it doesn't match, return as-is (might be in different format)
    return originalDate;
  }
  
  // If it's a Date object (fallback for other queries), extract UTC components
  if (originalDate instanceof Date) {
    const d = originalDate;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(d.getUTCMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  return null;
}

/**
 * Calculate hours for normal (non-split) shift
 * Uses first IN and last OUT
 */
function calculateNormalShiftHours(dayLogs: AttendanceLog[], shift: ShiftTiming): DayHours {
  // Sort by time - LogDate is now a string from TO_CHAR, parse it for comparison
  const sorted = [...dayLogs].sort((a, b) => {
    const logDateA = a.LogDate as any; // Can be Date or string from TO_CHAR
    const logDateB = b.LogDate as any; // Can be Date or string from TO_CHAR
    const timeA = typeof logDateA === 'string' 
      ? new Date(logDateA.replace(' ', 'T')).getTime()
      : parseAsLocalTime(logDateA).getTime();
    const timeB = typeof logDateB === 'string'
      ? new Date(logDateB.replace(' ', 'T')).getTime()
      : parseAsLocalTime(logDateB).getTime();
    return timeA - timeB;
  });

  // LogDate is now a string from PostgreSQL TO_CHAR (format: 'YYYY-MM-DDTHH24:MI:SS.MS')
  const firstLogOriginal = sorted[0].LogDate as any; // Can be Date or string
  const lastLogOriginal = sorted[sorted.length - 1].LogDate as any; // Can be Date or string
  
  // Parse for calculations (needs Date object for time comparisons)
  // If it's a string, parse it directly without timezone conversion
  let firstEntry: Date | null = null;
  let lastExit: Date | null = null;
  
  if (typeof firstLogOriginal === 'string') {
    // Parse string directly: '2026-01-01T10:10:25.000'
    const match = firstLogOriginal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
    if (match) {
      const [, year, month, day, hour, minute, second, ms] = match;
      firstEntry = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(ms || '0')
      );
    }
  } else {
    firstEntry = parseAsLocalTime(firstLogOriginal);
  }
  
  if (typeof lastLogOriginal === 'string') {
    const match = lastLogOriginal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
    if (match) {
      const [, year, month, day, hour, minute, second, ms] = match;
      lastExit = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(ms || '0')
      );
    }
  } else {
    lastExit = parseAsLocalTime(lastLogOriginal);
  }
  

  // If there's only one log, determine if it's an entry or an exit
  if (dayLogs.length === 1 && firstEntry) {
    // Use local hour (Date was created from string without timezone)
    const hour = firstEntry.getHours();
    
    // If log is after 2:00 PM (14:00), treat as checkout only
    if (hour >= 14) {
      lastExit = firstEntry;
      firstEntry = null;
    } else {
      // If log is before 2:00 PM, treat as check-in only
      // firstEntry already set, just clear lastExit
      lastExit = null;
    }
  }

  // Calculate total hours (handles midnight crossover)
  // Only calculate if both entry and exit are present
  let totalHours = (firstEntry && lastExit) ? calculateHours(firstEntry, lastExit) : 0;
  
  // If hours is negative or NaN, it might be a data issue - treat as minimal hours
  if (isNaN(totalHours) || totalHours < 0) {
    console.warn(`[Payroll] Invalid hours calculated: ${totalHours}. Setting to 0.`);
    totalHours = 0;
  }
  
  // Cap at reasonable maximum (24 hours)
  if (totalHours > 24) {
    console.warn(`[Payroll] Excessive hours (${totalHours}). Capping at 24.`);
    totalHours = 24;
  }

  // Check if late entry (after start time + late threshold)
  // Only late if there IS an entry
  let isLate = false;
  let isLateBy30Minutes = false;
  let minutesLate: number | null = null;
  if (firstEntry) {
    // Use local time components (Date was created from string without timezone)
    const entryHours = firstEntry.getHours();
    const entryMinutes = firstEntry.getMinutes();
    const entrySeconds = firstEntry.getSeconds();
    const entryTimeInSeconds = entryHours * 3600 + entryMinutes * 60 + entrySeconds;
    
    // Calculate shift start time
    const startTimeInSeconds = shift.startHour * 3600 + shift.startMinute * 60;
    
    // Calculate late threshold: start time + late threshold minutes
    const lateThresholdInSeconds = startTimeInSeconds + (shift.lateThresholdMinutes * 60);
    
    isLate = entryTimeInSeconds > lateThresholdInSeconds;
    
    // Calculate minutes late from shift start time (not from late threshold)
    if (isLate) {
      minutesLate = Math.round((entryTimeInSeconds - startTimeInSeconds) / 60);
    }
    
    // Check if late by 30+ minutes from reporting time (shift start time)
    const lateBy30MinutesThreshold = startTimeInSeconds + (30 * 60); // 30 minutes = 1800 seconds
    isLateBy30Minutes = entryTimeInSeconds > lateBy30MinutesThreshold;
  } else if (lastExit && dayLogs.length === 1) {
    // If only checkout exists, we don't know when they arrived, but we mark as late
    // for deduction purposes because they missed the morning check-in
    isLate = true;
    isLateBy30Minutes = true; // Missing check-in is considered late by 30+ minutes
    // Can't calculate exact minutes late since we don't know when they arrived
    minutesLate = null;
  }

  // Check if early exit (before end time - early exit threshold)
  // Only early exit if there IS an exit
  let isEarlyExit = false;
  if (lastExit) {
    // Use local time components (Date was created from string without timezone)
    const exitTime = lastExit.getHours() * 60 + lastExit.getMinutes();
    // Calculate expected end time in minutes
    const expectedEnd = shift.endHour * 60 + shift.endMinute;
    isEarlyExit = exitTime < (expectedEnd - config.earlyExitThresholdMinutes);
  } else if (firstEntry && dayLogs.length === 1) {
    // If only check-in exists, they missed the evening checkout
    isEarlyExit = true;
  }

  // Determine status based on hours worked
  // Use shift-specific work hours to calculate dynamic thresholds
  const workHours = shift.workHours || config.defaultWorkHoursPerDay;
  
  // Calculate dynamic thresholds based on shift work hours
  const halfDayThreshold = workHours / 2;
  const fullDayThreshold = workHours * 0.97; // 95% of full day threshold
  
  let status: DayHours['status'] = 'absent';
  
  if (totalHours < halfDayThreshold) {
    status = 'absent';
  } else if (totalHours >= fullDayThreshold) {
    status = 'full-day';
  } else {
    status = 'half-day';
  }

  // Format times directly from original Date objects (PostgreSQL UTC components = stored value)
  const formattedFirstEntry = formatFromOriginalDate(firstLogOriginal);
  const formattedLastExit = formatFromOriginalDate(lastLogOriginal);
  

  return {
    firstEntry: formattedFirstEntry,
    lastExit: formattedLastExit,
    totalHours: parseFloat(totalHours.toFixed(2)),
    isLate,
    isLateBy30Minutes,
    minutesLate,
    isEarlyExit,
    status,
    logCount: dayLogs.length,
  };
}

/**
 * Calculate hours for split shift
 * Processes each slot independently and sums the hours
 * Late flag is triggered if ANY slot is late
 */
function calculateSplitShiftHours(dayLogs: AttendanceLog[], shift: ShiftTiming): DayHours {
  if (!shift.slot1 || !shift.slot2) {
    console.error('[Payroll] Split shift missing slot definitions');
    return {
      firstEntry: null,
      lastExit: null,
      totalHours: 0,
      isLate: false,
      isLateBy30Minutes: false,
      minutesLate: null,
      isEarlyExit: false,
      status: 'absent',
      logCount: 0,
    };
  }

  // Sort logs by time - LogDate is now a string from TO_CHAR
  const sorted = [...dayLogs].sort((a, b) => {
    const logDateA = a.LogDate as any; // Can be Date or string
    const logDateB = b.LogDate as any; // Can be Date or string
    const timeA = typeof logDateA === 'string' 
      ? new Date(logDateA.replace(' ', 'T')).getTime()
      : parseAsLocalTime(logDateA).getTime();
    const timeB = typeof logDateB === 'string'
      ? new Date(logDateB.replace(' ', 'T')).getTime()
      : parseAsLocalTime(logDateB).getTime();
    return timeA - timeB;
  });

  // Parse logs - if string, parse directly; otherwise use parseAsLocalTime
  const parsedLogs = sorted.map(log => {
    const logDate = log.LogDate as any; // Can be Date or string
    if (typeof logDate === 'string') {
      const match = logDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
      if (match) {
        const [, year, month, day, hour, minute, second, ms] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second),
          parseInt(ms || '0')
        );
      }
    }
    return parseAsLocalTime(logDate);
  });

  // Helper function to convert hours/minutes to minutes since midnight
  const toMinutes = (hours: number, minutes: number): number => hours * 60 + minutes;

  // Define slot boundaries in minutes since midnight
  const slot1Start = toMinutes(shift.slot1.startHour, shift.slot1.startMinute);
  const slot1End = toMinutes(shift.slot1.endHour, shift.slot1.endMinute);
  const slot2Start = toMinutes(shift.slot2.startHour, shift.slot2.startMinute);
  const slot2End = toMinutes(shift.slot2.endHour, shift.slot2.endMinute);

  // Calculate midpoint for splitting logs between slots
  // This is the time boundary that separates Slot 1 from Slot 2
  const midpointBetweenSlots = (slot1End + slot2Start) / 2;
  

  // Process Slot 1
  // Strategy: Find logs that likely belong to Slot 1 based on timing
  // Slot 1 typically has morning logs before the break
  let slot1Hours = 0;
  let slot1FirstIn: Date | null = null;
  let slot1LastOut: Date | null = null;
  let slot1IsLate = false;

  for (const log of parsedLogs) {
    const logMinutes = toMinutes(log.getHours(), log.getMinutes());
    
    // Slot 1: Any log before the midpoint between slot1 end and slot2 start
    // This captures early arrivals and late exits from Slot 1
    if (logMinutes < midpointBetweenSlots) {
      if (!slot1FirstIn) {
        slot1FirstIn = log;
        
        // Check if late for slot 1 (only check if within reasonable range of slot start)
        if (logMinutes >= slot1Start - 60 && logMinutes <= slot1Start + 60) {
          const lateThreshold = slot1Start + shift.lateThresholdMinutes;
          if (logMinutes > lateThreshold) {
            slot1IsLate = true;
          }
        }
      }
      slot1LastOut = log;
    }
  }

  if (slot1FirstIn && slot1LastOut) {
    slot1Hours = calculateHours(slot1FirstIn, slot1LastOut);
    // Cap slot hours at reasonable maximum (slot duration + 1 hour buffer)
    const maxSlotHours = ((slot1End - slot1Start) / 60) + 1;
    if (slot1Hours > maxSlotHours) {
      slot1Hours = maxSlotHours;
    }
  }


  // Process Slot 2
  // Slot 2: Any log at or after the midpoint
  // This captures early arrivals for evening shift
  let slot2Hours = 0;
  let slot2FirstIn: Date | null = null;
  let slot2LastOut: Date | null = null;
  let slot2IsLate = false;

  for (const log of parsedLogs) {
    const logMinutes = toMinutes(log.getHours(), log.getMinutes());
    
    // Slot 2: Any log at or after the midpoint between slot1 end and slot2 start
    if (logMinutes >= midpointBetweenSlots) {
      if (!slot2FirstIn) {
        slot2FirstIn = log;
        
        // Check if late for slot 2 (only check if within reasonable range of slot start)
        if (logMinutes >= slot2Start - 60 && logMinutes <= slot2Start + 60) {
          const lateThreshold = slot2Start + shift.lateThresholdMinutes;
          if (logMinutes > lateThreshold) {
            slot2IsLate = true;
          }
        }
      }
      slot2LastOut = log;
    }
  }

  if (slot2FirstIn && slot2LastOut) {
    slot2Hours = calculateHours(slot2FirstIn, slot2LastOut);
    // Cap slot hours at reasonable maximum (slot duration + 1 hour buffer)
    const maxSlotHours = ((slot2End - slot2Start) / 60) + 1;
    if (slot2Hours > maxSlotHours) {
      slot2Hours = maxSlotHours;
    }
  }


  // Calculate total hours (sum of both slots)
  let totalHours = slot1Hours + slot2Hours;

  // Ensure non-negative
  if (isNaN(totalHours) || totalHours < 0) {
    totalHours = 0;
  }

  // Cap at reasonable maximum
  if (totalHours > 24) {
    totalHours = 24;
  }


  // Late if EITHER slot is late
  const isLate = slot1IsLate || slot2IsLate;
  
  // Calculate minutes late from shift start time
  // For split shift, use Slot 1 start time as the primary reporting time
  let minutesLate: number | null = null;
  if (isLate && slot1FirstIn) {
    const slot1EntryMinutes = toMinutes(slot1FirstIn.getHours(), slot1FirstIn.getMinutes());
    minutesLate = Math.round(slot1EntryMinutes - slot1Start);
  } else if (isLate && slot2FirstIn && !slot1FirstIn) {
    // If only slot 2 has entry and is late, calculate from slot 2 start
    const slot2EntryMinutes = toMinutes(slot2FirstIn.getHours(), slot2FirstIn.getMinutes());
    minutesLate = Math.round(slot2EntryMinutes - slot2Start);
  }
  
  // Check if late by 30+ minutes for split shift
  // For split shift, check if Slot 1 is late by 30+ minutes (Slot 1 is the primary reporting time)
  let isLateBy30Minutes = false;
  if (slot1FirstIn) {
    const slot1EntryMinutes = toMinutes(slot1FirstIn.getHours(), slot1FirstIn.getMinutes());
    const lateBy30MinutesThreshold = slot1Start + 30; // 30 minutes from slot 1 start
    isLateBy30Minutes = slot1EntryMinutes > lateBy30MinutesThreshold;
  } else if (slot2FirstIn && !slot1FirstIn) {
    // If only slot 2 has entry, check if slot 2 is late by 30+ minutes
    const slot2EntryMinutes = toMinutes(slot2FirstIn.getHours(), slot2FirstIn.getMinutes());
    const lateBy30MinutesThreshold = slot2Start + 30; // 30 minutes from slot 2 start
    isLateBy30Minutes = slot2EntryMinutes > lateBy30MinutesThreshold;
  } else if (!slot1FirstIn && !slot2FirstIn) {
    // No entry at all - consider as late by 30+ minutes
    isLateBy30Minutes = true;
  }

  // Early exit is not applicable for split shifts in the same way
  // We'll mark as early exit if neither slot has proper attendance
  const isEarlyExit = (!slot1FirstIn || !slot1LastOut) && (!slot2FirstIn || !slot2LastOut);

  // Determine status based on total hours worked
  const workHours = shift.workHours || config.defaultWorkHoursPerDay;
  const halfDayThreshold = workHours / 2;
  const fullDayThreshold = workHours;

  let status: DayHours['status'] = 'absent';

  if (totalHours < halfDayThreshold) {
    status = 'absent';
  } else if (totalHours >= fullDayThreshold) {
    status = 'full-day';
  } else {
    status = 'half-day';
  }

  // Use earliest entry and latest exit for display purposes
  const firstEntry = slot1FirstIn || slot2FirstIn;
  const lastExit = slot2LastOut || slot1LastOut;

  // Format from Date object (created from string, so use local components)
  const formatFromDate = (date: Date | null): string | null => {
    if (!date) return null;
    const d = date;
    // Use local time components since Date was created from string without timezone
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  return {
    firstEntry: formatFromDate(firstEntry),
    lastExit: formatFromDate(lastExit),
    totalHours: parseFloat(totalHours.toFixed(2)),
    isLate,
    isLateBy30Minutes,
    minutesLate,
    isEarlyExit,
    status,
    logCount: dayLogs.length,
  };
}

/**
 * Resolve shift for a specific date
 * Priority: 1. Shift Assignment, 2. EmployeeDetails.Shift, 3. Default Shift
 * @param employeeCode Employee code
 * @param date Date in YYYY-MM-DD format
 * @param assignments Pre-fetched shift assignments (optional, for performance)
 * @param employeeDetails Pre-fetched employee details (optional, for performance)
 * @returns ShiftTiming or null
 */
async function resolveShiftForDate(
  employeeCode: string,
  date: string,
  assignments?: any[],
  employeeDetails?: any
): Promise<ShiftTiming | null> {
  try {
    const { EmployeeShiftAssignmentModel } = await import('../models/EmployeeShiftAssignmentModel.js');
    const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
    const { ShiftModel } = await import('../models/ShiftModel.js');

    let shiftName: string | null = null;

    // Step 1: Check shift assignments (date-wise)
    let shiftAssignments = assignments;
    if (!shiftAssignments) {
      // Fetch assignments for the month (we'll fetch once and reuse)
      const { start, end } = getMonthRange(date.substring(0, 7)); // Extract YYYY-MM from date
      shiftAssignments = await EmployeeShiftAssignmentModel.getAssignmentsForEmployee(
        employeeCode,
        start,
        end
      );
    }

    shiftName = EmployeeShiftAssignmentModel.getShiftForDate(shiftAssignments, date);

    // Step 2: Fallback to EmployeeDetails.Shift
    if (!shiftName) {
      let details = employeeDetails;
      if (!details) {
        details = await EmployeeDetailsModel.getByCode(employeeCode);
      }
      if (details?.Shift) {
        shiftName = details.Shift;
      }
    }

    // Step 3: Fallback to default shift
    if (!shiftName) {
      const defaultShift = await ShiftModel.getDefaultShift();
      if (defaultShift) {
        shiftName = defaultShift.ShiftName;
      }
    }

    // Step 4: Get shift definition and parse timing
    if (shiftName) {
      const shift = await ShiftModel.getByName(shiftName);
      if (shift) {
        const shiftTiming = ShiftModel.parseShiftTiming(shift);
        if (shiftTiming) {
          return shiftTiming;
        }
      }
    }

    // Step 5: Final fallback - hardcoded default
    return {
      startHour: 10,
      startMinute: 0,
      endHour: 19,
      endMinute: 0,
      workHours: 9,
      lateThresholdMinutes: 12,
      isSplitShift: false,
    };
  } catch (error: any) {
    console.warn(`[Payroll] Error resolving shift for date ${date}: ${error.message}`);
    // Return hardcoded default on error
    return {
      startHour: 10,
      startMinute: 0,
      endHour: 19,
      endMinute: 0,
      workHours: 9,
      lateThresholdMinutes: 12,
      isSplitShift: false,
    };
  }
}

/**
 * Calculate monthly working hours and attendance summary
 */
export async function calculateMonthlyHours(
  userId: number | string,
  month: string,
  joinDateStr?: string,
  exitDateStr?: string,
  paidLeaveDates?: LeaveDateWithValue[],
  casualLeaveDates?: LeaveDateWithValue[]
): Promise<MonthlyAttendance> {
  // Pre-fetch shift assignments and employee details for performance
  let shiftAssignments: any[] = [];
  let employeeDetails: any = null;
  try {
    const { EmployeeShiftAssignmentModel } = await import('../models/EmployeeShiftAssignmentModel.js');
    const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
    
    const { start, end } = getMonthRange(month);
    // userid in devicelogs is VARCHAR (string), convert to string
    const userIdStr = String(userId);
    shiftAssignments = await EmployeeShiftAssignmentModel.getAssignmentsForEmployee(
      userIdStr,
      start,
      end
    );
    employeeDetails = await EmployeeDetailsModel.getByCode(userIdStr);
    
    if (shiftAssignments.length > 0) {
    }
  } catch (error: any) {
    console.warn(`[Payroll] Could not pre-fetch shift assignments for employee ${userId}: ${error.message}`);
  }

  const logs = await getMonthlyAttendance(userId, month);
  const groupedLogs = groupByDate(logs);
  console.log(`[Payroll] Attendance: ${logs.length} logs found for employee ${userId} in ${month}`);

  const dailyBreakdown: DailyBreakdown[] = [];
  let totalWorkedHours = 0;
  let fullDays = 0;
  let halfDays = 0;
  let lateDays = 0;
  let lateBy30MinutesDays = 0; // Count of days late by 30+ minutes
  let earlyExits = 0;
  let absentDays = 0;

  // Get total days in salary cycle (26th to 25th)
  const { start, end } = getMonthRange(month);
  
  // Effective range based on joining/exit dates
  const effectiveStart = joinDateStr && joinDateStr > start ? joinDateStr : start;
  const effectiveEnd = exitDateStr && exitDateStr < end ? exitDateStr : end;

  const startDate = createLocalDate(effectiveStart);
  const endDate = createLocalDate(effectiveEnd);
  
  // Total days in the ACTUAL salary cycle for this employee
  const fullCycleStart = createLocalDate(start);
  const fullCycleEnd = createLocalDate(end);
  const cycleDiffMs = fullCycleEnd.getTime() - fullCycleStart.getTime();
  const totalDaysInCycle = Math.round(cycleDiffMs / (1000 * 60 * 60 * 24)) + 1;

  // Days in the EFFECTIVE range
  const effectiveDiffMs = endDate.getTime() - startDate.getTime();
  if (effectiveDiffMs < 0) {
    console.warn(`[Payroll] Invalid effective range for employee ${userId}: ${effectiveStart} to ${effectiveEnd}`);
  }
  
  // Calculate effective days in cycle (for employees who joined/left mid-cycle)
  const effectiveDaysInCycle = Math.max(0, Math.round(effectiveDiffMs / (1000 * 60 * 60 * 24)) + 1);

  // First pass: Calculate for each day in the FULL cycle, but only count logs in effective range
  const currentDate = new Date(fullCycleStart);
  for (let d = 0; d < totalDaysInCycle; d++) {
    const dateStr = formatDate(currentDate);
    const isWithinEffectiveRange = dateStr >= effectiveStart && dateStr <= effectiveEnd;

    // Resolve shift for this specific date (date-wise shift resolution)
    const dayShiftTiming = await resolveShiftForDate(
      userId.toString(),
      dateStr,
      shiftAssignments,
      employeeDetails
    );

    const dayLogs = isWithinEffectiveRange ? (groupedLogs[dateStr] || []) : [];
    const dayStats = calculateDayHours(dayLogs, dayShiftTiming);

    // Check if current date is a Sunday (0 = Sunday)
    const isSunday = getDay(currentDate) === 0;

    // If day is outside the effective range (before joining or after exit),
    // mark it as 'not-active' so it's not counted as an absence in UI/Logic.
    if (!isWithinEffectiveRange) {
      dayStats.status = 'not-active';
    }

    dailyBreakdown.push({
      date: dateStr,
      ...dayStats,
    });

    if (isWithinEffectiveRange) {
      // Don't count Sundays in worked hours or day counts (they're weekoff)
      if (!isSunday) {
        totalWorkedHours += dayStats.totalHours;

        if (dayStats.status === 'full-day') fullDays++;
        if (dayStats.status === 'half-day') {
          halfDays++;
        }
        
        // ABSENCE COUNTING: Only count as absent if:
        // 1. It is within the effective range (after joining, before exit)
        // 2. The day status is 'absent'
        // 3. It is NOT a Sunday
        if (dayStats.status === 'absent') {
          absentDays++;
        }
        
        // LATE DAYS COUNTING: Only count late days if status is 'full-day' or 'half-day'
        // Do NOT count late days for:
        // - Absent days (already penalized as absent - will be handled during regularization if needed)
        // - Not-active days (outside effective range)
        // Note: Regularized days will be removed from late count during regularization pass
        if (dayStats.isLate && (dayStats.status === 'full-day' || dayStats.status === 'half-day')) {
          lateDays++;
        }
        
        // Count 30+ minute late days ONLY if employee completed full working hours
        // If they worked less than required hours, they're already penalized as half-day/absent
        // So no additional 30+ minute deduction should apply
        if (dayStats.isLateBy30Minutes && dayStats.status === 'full-day') {
          lateBy30MinutesDays++;
        }
        
        if (dayStats.isEarlyExit) earlyExits++;
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Second pass: Apply attendance regularizations FIRST
  // This must happen before Sunday marking so that Sunday pay can be recalculated
  // based on the updated absent count after regularizations
  // Regularizations convert absent/half-day to full-day (present)
  
  try {
    const { AttendanceRegularizationModel } = await import('../models/AttendanceRegularizationModel.js');
    const regularizations = await AttendanceRegularizationModel.getRegularizationsByDateRange(
      userId.toString(),
      effectiveStart,
      effectiveEnd
    );

    if (regularizations.length > 0) {
      
      for (const reg of regularizations) {
        const regDateStr = formatDate(new Date(reg.RegularizationDate));
        const dayEntry = dailyBreakdown.find(d => d.date === regDateStr);
        
        if (dayEntry) {
          const originalStatus = dayEntry.status;
          const regularizedStatus = reg.RegularizedStatus || 'full-day'; // Default to 'full-day' if not specified
          
          // Store original status before regularization
          (dayEntry as any).originalStatus = originalStatus;
          (dayEntry as any).isRegularized = true;
          (dayEntry as any).regularizationReason = reg.Reason;
          
          // Update counters (remove from original status counts)
          if (dayEntry.status === 'absent') {
            absentDays--;
            console.log(`[Payroll] Regularizing ${regDateStr}: DECREMENTING absentDays from ${absentDays + 1} to ${absentDays}`);
          } else if (dayEntry.status === 'half-day') {
            halfDays--;
            console.log(`[Payroll] Regularizing ${regDateStr}: DECREMENTING halfDays from ${halfDays + 1} to ${halfDays}`);
          }
          
          // Convert to regularized status (half-day or full-day)
          dayEntry.status = regularizedStatus as 'half-day' | 'full-day';
          
          // Update counters based on regularized status
          if (regularizedStatus === 'full-day') {
            fullDays++;
          } else if (regularizedStatus === 'half-day') {
            halfDays++;
          }
          
          // If this day was counted as late, remove it from late count
          // Regularized days should NOT count as late (they were absent/half-day, converted to present)
          if (dayEntry.isLate && (originalStatus === 'absent' || originalStatus === 'half-day')) {
            lateDays--;
          }
          
        } else {
          console.warn(`[Payroll] ⚠️ Regularization date ${regDateStr} not found in daily breakdown`);
        }
      }
      
      console.log(`[Payroll] After regularizations: absentDays=${absentDays}, fullDays=${fullDays}, halfDays=${halfDays}`);
    }
  } catch (error: any) {
    console.warn('[Payroll] Could not fetch regularizations (table may not exist yet):', error.message);
  }

  // IMPORTANT: Store original absent/half-days count AFTER regularization but BEFORE PL/CL
  // This is used for the "5+ days unpaid Sundays" rule
  // PL/CL approvals should NOT change this rule - if employee originally had 5+ days leave,
  // all Sundays remain unpaid even after PL/CL adjustments
  // 
  // For new joiners: Only count leaves AFTER joining date
  // For contract cessation: Only count leaves BEFORE exit date
  let originalAbsentDaysForSundayRule = 0;
  let originalHalfDaysForSundayRule = 0;
  
  // Check if this is a new joiner or contract cessation scenario
  const isNewJoiner = joinDateStr && joinDateStr > start;
  const isContractCessation = exitDateStr && exitDateStr < end;
  
  if (isNewJoiner || isContractCessation) {
    // Count leaves only in the relevant period (after join date or before exit date)
    // IMPORTANT: We need to count from dailyBreakdown to ensure we only count days
    // in the correct period (after join date or before exit date)
    // This count should match the absentDays/halfDays counters but filtered by date range
    for (const dayEntry of dailyBreakdown) {
      const dayDate = dayEntry.date;
      
      // Skip days outside effective range
      if (dayDate < effectiveStart || dayDate > effectiveEnd) {
        continue;
      }
      
      // For new joiners: Only count days AFTER joining date
      if (isNewJoiner && dayDate <= joinDateStr) {
        continue;
      }
      
      // For contract cessation: Only count days BEFORE exit date (strictly less than)
      // Exit date itself should not be counted
      if (isContractCessation && dayDate >= exitDateStr) {
        continue;
      }
      
      // Skip Sundays - they are weekoffs, not absences for LOP calculation
      const dayDateObj = parseISO(dayDate);
      const isSunday = getDay(dayDateObj) === 0;
      if (isSunday) {
        continue;
      }
      
      // Skip days marked as 'not-active' (outside effective range)
      if (dayEntry.status === 'not-active') {
        continue;
      }
      
      // Count absent/half-day days (after regularization, before PL/CL)
      // Use the status at this point (after regularization, before PL/CL adjustments)
      // Regularized days should have status 'full-day' or 'half-day', not 'absent'
      if (dayEntry.status === 'absent') {
        originalAbsentDaysForSundayRule++;
        console.log(`[Payroll] Counting absent day for Sunday rule: ${dayDate} (status: ${dayEntry.status})`);
      } else if (dayEntry.status === 'half-day') {
        originalHalfDaysForSundayRule++;
        console.log(`[Payroll] Counting half-day for Sunday rule: ${dayDate} (status: ${dayEntry.status})`);
      }
    }
    
  } else {
    // For regular employees: Count all leaves in the cycle
    originalAbsentDaysForSundayRule = absentDays;
    originalHalfDaysForSundayRule = halfDays;
  }
  
  const originalTotalLopDaysForSundayRule = originalAbsentDaysForSundayRule + (originalHalfDaysForSundayRule * 0.5);
  

  // Second-and-a-half pass: Apply paid leave adjustments
  // Paid leave days should NOT count as "absent" for Sunday payment calculation
  // Mark them as 'paid-leave' status so sandwich rule works correctly
  // NOTE: This reduces absentDays count, but Sunday payment rule uses original count
  // Now supports explicit values (0.5 or 1.0) for each leave date
  if (paidLeaveDates && paidLeaveDates.length > 0) {
    
    for (const leaveItem of paidLeaveDates) {
      // Validate leave item structure
      if (!leaveItem || typeof leaveItem !== 'object') {
        console.warn(`[Payroll] Invalid paid leave item: ${JSON.stringify(leaveItem)}, skipping`);
        continue;
      }
      
      const leaveDate = leaveItem.date;
      const leaveValue = leaveItem.value; // 0.5 or 1.0
      
      if (!leaveDate || typeof leaveDate !== 'string') {
        console.warn(`[Payroll] Paid leave date is invalid: ${leaveDate}, skipping`);
        continue;
      }
      
      if (leaveValue !== 0.5 && leaveValue !== 1.0) {
        console.warn(`[Payroll] Paid leave value is invalid: ${leaveValue} for date ${leaveDate}, using default 1.0`);
        leaveItem.value = 1.0;
      }
      
      const dayEntry = dailyBreakdown.find(d => d.date === leaveDate);
      
      if (dayEntry && (dayEntry.status === 'absent' || dayEntry.status === 'half-day')) {
        const originalStatus = dayEntry.status;
        
        // Store leave value for salary calculation
        (dayEntry as any).leaveValue = leaveValue;
        (dayEntry as any).isLeaveApproved = true;
        
        // Update counters based on leave value
        // If value is 1.0, remove from absent/half-day counts completely
        // If value is 0.5, only partially remove (for half-day cases)
        if (dayEntry.status === 'absent') {
          if (leaveValue === 1.0) {
            absentDays--;
            console.log(`[Payroll] Paid leave ${leaveDate} (${leaveValue}): DECREMENTING absentDays from ${absentDays + 1} to ${absentDays}`);
          } else if (leaveValue === 0.5) {
            // Half-day paid leave: still 0.5 day absent
            console.log(`[Payroll] Paid leave ${leaveDate} (${leaveValue}): Half-day paid, 0.5 day still absent`);
          }
        } else if (dayEntry.status === 'half-day') {
          if (leaveValue === 1.0) {
            halfDays--;
            console.log(`[Payroll] Paid leave ${leaveDate} (${leaveValue}): DECREMENTING halfDays from ${halfDays + 1} to ${halfDays}`);
          } else if (leaveValue === 0.5) {
            // Half-day paid leave on half-day worked: no change to counters
            console.log(`[Payroll] Paid leave ${leaveDate} (${leaveValue}): Half-day paid on half-day worked, no counter change`);
          }
        }
        
        // Mark as paid leave (so it's not treated as "absent" for sandwich rule)
        dayEntry.status = 'paid-leave';
        (dayEntry as any).originalStatus = originalStatus;
        
      }
    }
  }

  // Apply casual leave adjustments
  // Business Rule: Casual leave ADDS value days to existing attendance (counted separately)
  // Now supports explicit values (0.5 or 1.0) for each leave date
  // - If value is 1.0: full day credit
  // - If value is 0.5: half day credit
  if (casualLeaveDates && casualLeaveDates.length > 0) {
    
    for (const leaveItem of casualLeaveDates) {
      // Validate leave item structure
      if (!leaveItem || typeof leaveItem !== 'object') {
        console.warn(`[Payroll] Invalid casual leave item: ${JSON.stringify(leaveItem)}, skipping`);
        continue;
      }
      
      const leaveDate = leaveItem.date;
      const leaveValue = leaveItem.value; // 0.5 or 1.0
      
      if (!leaveDate || typeof leaveDate !== 'string') {
        console.warn(`[Payroll] Casual leave date is invalid: ${leaveDate}, skipping`);
        continue;
      }
      
      if (leaveValue !== 0.5 && leaveValue !== 1.0) {
        console.warn(`[Payroll] Casual leave value is invalid: ${leaveValue} for date ${leaveDate}, using default 0.5`);
        leaveItem.value = 0.5;
      }
      
      const dayEntry = dailyBreakdown.find(d => d.date === leaveDate);
      
      if (dayEntry && (dayEntry.status === 'absent' || dayEntry.status === 'half-day')) {
        const originalStatus = dayEntry.status;
        
        // Store leave value for salary calculation
        (dayEntry as any).leaveValue = leaveValue;
        (dayEntry as any).isLeaveApproved = true;
        (dayEntry as any).originalStatus = originalStatus;
        (dayEntry as any).hasCasualLeave = true;
        
        // Update counters based on original status and leave value
        if (originalStatus === 'absent') {
          if (leaveValue === 1.0) {
            // Full-day casual leave: remove from absent count
            absentDays--;
            console.log(`[Payroll] Casual leave ${leaveDate} (${leaveValue}): Removed from absent count (full-day casual leave)`);
          } else if (leaveValue === 0.5) {
            // Half-day casual leave: still 0.5 day absent
            console.log(`[Payroll] Casual leave ${leaveDate} (${leaveValue}): Half-day casual leave, 0.5 day still absent`);
          }
        } else if (originalStatus === 'half-day') {
          // Keep half-day count as is (0.5 worked will remain, casual leave will be added separately)
          // DO NOT change halfDays or fullDays - let casual leave add on top
          console.log(`[Payroll] Casual leave ${leaveDate} (${leaveValue}): Keeping half-day count (0.5 worked + ${leaveValue} casual leave counted separately)`);
        }
        
        // Mark status as casual-leave for sandwich rule and UI display
        dayEntry.status = 'casual-leave';
        
      }
    }
  }
  

  // Third pass: Mark Sundays as "weekoff" with paid/unpaid based on ORIGINAL leave days
  // This happens AFTER regularizations and PL/CL adjustments
  // Rules:
  // 1. If 5+ LOP days (ORIGINAL absent days + half-days AFTER regularization, BEFORE PL/CL) → all Sundays unpaid
  //    - Half days count as 0.5 towards the 5-day threshold
  //    - Example: 4 absents + 3 half-days = 4 + 1.5 = 5.5 LOP days (triggers unpaid Sundays)
  //    - IMPORTANT: PL/CL approvals do NOT change this rule - if originally 5+ days, all Sundays remain unpaid
  //    - For new joiners: Only count leaves AFTER joining date
  //    - For contract cessation: Only count leaves BEFORE exit date
  // 2. Otherwise, Sunday is NOT paid if employee was absent on BOTH Saturday before AND Monday after (sandwich rule)
  //    - SANDWICH RULE IS CURRENTLY DISABLED (COMMENTED OUT)
  // Note: Sandwich rule uses UPDATED statuses (after regularizations and PL/CL)
  // Note: 5+ days rule uses ORIGINAL counts (after regularization, before PL/CL, filtered by join/exit dates)
  const hasFiveOrMoreLeaveDays = originalTotalLopDaysForSundayRule >= 5;
  
  // Note: isNewJoiner and isContractCessation are already declared above when calculating filtered leaves
  // We still need to track this for the "worked in week" logic, but 5+ days rule applies if filtered leaves are 5+
  
  
  // Create a map of date -> status for quick lookup (with updated statuses after regularizations)
  const attendanceMap = new Map<string, string>();
  dailyBreakdown.forEach(day => {
    attendanceMap.set(day.date, day.status);
  });
  
  
  currentDate.setTime(fullCycleStart.getTime());
  
  for (let d = 0; d < totalDaysInCycle; d++) {
    const dateStr = formatDate(currentDate);
    const isWithinEffectiveRange = dateStr >= effectiveStart && dateStr <= effectiveEnd;
    const isSunday = getDay(currentDate) === 0;

    if (isWithinEffectiveRange && isSunday) {
      const dayEntry = dailyBreakdown[d];
      dayEntry.status = 'weekoff';
      
      // Rule 1: If 5+ filtered LOP days (after join date for new joiners, before exit date for contract cessation),
      // all Sundays are unpaid
      // PL/CL approvals do NOT change this rule - if originally had 5+ filtered days leave, all Sundays remain unpaid
      if (hasFiveOrMoreLeaveDays) {
        dayEntry.weekoffType = 'unpaid';
      }
      // For new joiners and contract cessation (without 5+ filtered leaves): Pay Sundays of weeks where they worked
      else if (isNewJoiner || isContractCessation) {
        // Check if employee worked any day in the week containing this Sunday
        // Week runs from Monday (day 1) to Sunday (day 0)
        const sundayDate = new Date(currentDate);
        const mondayOfWeek = new Date(sundayDate);
        mondayOfWeek.setDate(sundayDate.getDate() - 6); // Go back 6 days to get Monday
        
        let workedInWeek = false;
        // Check all 7 days of the week (Monday to Sunday)
        for (let i = 0; i < 7; i++) {
          const weekDay = new Date(mondayOfWeek);
          weekDay.setDate(mondayOfWeek.getDate() + i);
          const weekDayStr = formatDate(weekDay);
          
          // Only check days within effective range
          if (weekDayStr >= effectiveStart && weekDayStr <= effectiveEnd) {
            const weekDayStatus = attendanceMap.get(weekDayStr);
            // Consider it "worked" if status is full-day, half-day, paid-leave, casual-leave, or regularized (full-day)
            if (weekDayStatus === 'full-day' || weekDayStatus === 'half-day' || 
                weekDayStatus === 'paid-leave' || weekDayStatus === 'casual-leave') {
              workedInWeek = true;
              break;
            }
          }
        }
        
        if (workedInWeek) {
          dayEntry.weekoffType = 'paid';
          console.log(`[Payroll] ✅ Sunday ${dateStr} marked as PAID (new joiner/cessation: worked in this week)`);
        } else {
          dayEntry.weekoffType = 'unpaid';
          console.log(`[Payroll] ❌ Sunday ${dateStr} marked as UNPAID (new joiner/cessation: no work in this week)`);
        }
      } 
      else {
        // Rule 2: Apply sandwich rule - Sunday is NOT paid if absent on BOTH Saturday AND Monday
        // SANDWICH RULE IS CURRENTLY DISABLED - All Sundays are marked as PAID if 5+ days rule doesn't apply
        // Use UPDATED statuses (after regularizations)
        // const saturdayDate = new Date(currentDate);
        // saturdayDate.setDate(saturdayDate.getDate() - 1);
        // const saturdayStr = formatDate(saturdayDate);
        // const saturdayStatus = attendanceMap.get(saturdayStr);
        
        // const mondayDate = new Date(currentDate);
        // mondayDate.setDate(mondayDate.getDate() + 1);
        // const mondayStr = formatDate(mondayDate);
        // const mondayStatus = attendanceMap.get(mondayStr);
        
        // console.log(`[Payroll] Sunday ${dateStr} sandwich check: Saturday ${saturdayStr}=${saturdayStatus}, Monday ${mondayStr}=${mondayStatus}`);
        
        // Sandwich Rule: Sunday is NOT paid ONLY if employee was ACTUALLY ABSENT (unpaid) on BOTH Saturday AND Monday
        // Important: paid-leave, casual-leave, and regularized days (full-day) are NOT considered "absent"
        // Only status='absent' (unpaid absence) counts as truly absent for sandwich rule
        // const isAbsentSaturday = saturdayStatus === 'absent';
        // const isAbsentMonday = mondayStatus === 'absent';
        
        // Note: Uses updated statuses after regularizations and leave applications:
        // - Regularized days are now 'full-day'
        // - Paid leave days are now 'paid-leave'
        // - Casual leave days are now 'casual-leave'
        // if (isAbsentSaturday && isAbsentMonday) {
        //   dayEntry.weekoffType = 'unpaid';
        //   console.log(`[Payroll] ❌ Sunday ${dateStr} marked as UNPAID (sandwich rule: UNPAID ABSENT on BOTH ${saturdayStr} AND ${mondayStr})`);
        // } else {
        //   dayEntry.weekoffType = 'paid';
        //   console.log(`[Payroll] ✅ Sunday ${dateStr} marked as PAID (Saturday=${saturdayStatus}, Monday=${mondayStatus} - not both unpaid absent)`);
        // }
        
        // SANDWICH RULE DISABLED: All Sundays are PAID if 5+ days rule doesn't apply
        dayEntry.weekoffType = 'paid';
      }
      
      // Reset other fields for weekoff days
      dayEntry.firstEntry = null;
      dayEntry.lastExit = null;
      dayEntry.totalHours = 0;
      dayEntry.isLate = false;
      dayEntry.isEarlyExit = false;
      dayEntry.logCount = 0;
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`[Payroll] Attendance calculated: ${fullDays} full + ${halfDays} half days, ${absentDays} absent, ${lateDays} late (${lateBy30MinutesDays} by 30+ min), ${totalWorkedHours.toFixed(2)}h worked`);
  
  return {
    employeeCode: userId.toString(),
    month,
    totalDaysInMonth: effectiveDaysInCycle, // Use effective days (based on join/exit dates) instead of full cycle
    totalWorkedHours: parseFloat(totalWorkedHours.toFixed(2)),
    fullDays,
    halfDays,
    absentDays,
    lateDays,
    lateBy30MinutesDays,
    earlyExits,
    dailyBreakdown,
  };
}

/**
 * Calculate overtime hours per day (not monthly)
 * Only counts days where workedHours > expectedDailyHours
 * Only counts overtime hours that are above 1 hour (overtime > 1 hour)
 * Ignores absent days and days without workedHours
 */
export function calculateOvertimePerDay(
  dailyBreakdown: DailyBreakdown[],
  expectedDailyHours: number
): number {
  let totalOvertimeHours = 0;
  const overtimeThreshold = 1.0; // Only count overtime above 1 hour
  
  for (const day of dailyBreakdown) {
    // Ignore absent days
    if (day.status === 'absent' || day.status === 'not-active') {
      continue;
    }
    
    // Ignore days without workedHours
    if (!day.totalHours || day.totalHours <= 0) {
      continue;
    }
    
    // Calculate overtime for this day
    if (day.totalHours > expectedDailyHours) {
      const dailyOvertime = day.totalHours - expectedDailyHours;
      
      // Only count overtime if it's above 1 hour (count all hours if above threshold)
      if (dailyOvertime > overtimeThreshold) {
        // Count all overtime hours if above 1 hour threshold
        totalOvertimeHours += dailyOvertime;
        console.log(`[Payroll] Overtime for ${day.date}: ${day.totalHours} - ${expectedDailyHours} = ${dailyOvertime.toFixed(2)} hours (counted, above ${overtimeThreshold}hr threshold)`);
      } else {
        console.log(`[Payroll] Overtime for ${day.date}: ${day.totalHours} - ${expectedDailyHours} = ${dailyOvertime.toFixed(2)} hours (ignored, below or equal to ${overtimeThreshold}hr threshold)`);
      }
    }
  }
  
  return totalOvertimeHours;
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use calculateOvertimePerDay instead
 */
export function calculateOvertime(totalWorkedHours: number, expectedHours: number): number {
  const overtime = totalWorkedHours - expectedHours;
  return overtime > 0 ? parseFloat(overtime.toFixed(2)) : 0;
}

/**
 * Get employee base salary from EmployeeDetails table (DATABASE)
 * REPLACES: Excel-based salary lookup
 */
export async function getBaseSalary(userId: number | string): Promise<BaseSalaryInfo> {
  try {
    // Import EmployeeDetailsModel
    const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
    
    // Get salary data from EmployeeDetails table using employee code
    const employeeCode = String(userId);
    const salaryInfo = await EmployeeDetailsModel.getSalaryInfo(employeeCode);
    
    if (salaryInfo && salaryInfo.baseSalary && salaryInfo.baseSalary > 0) {
      return {
        baseSalary: salaryInfo.baseSalary,
        hourlyRate: salaryInfo.hourlyRate || 0,
      };
    }
    
    // Fallback: Try to get salary from Employees table
    console.warn(`[Payroll] Employee ${employeeCode} not found in EmployeeDetails, trying Employees table...`);
    const { EmployeeModel } = await import('../models/EmployeeModel.js');
    const employeeSalaryInfo = await EmployeeModel.getSalaryInfo(employeeCode);
    
    if (employeeSalaryInfo && employeeSalaryInfo.baseSalary && employeeSalaryInfo.baseSalary > 0) {
      console.log(`[Payroll] Using salary from Employees table: ₹${employeeSalaryInfo.baseSalary}`);
      return {
        baseSalary: employeeSalaryInfo.baseSalary,
        hourlyRate: employeeSalaryInfo.hourlyRate || 0,
      };
    }
    
    // Final fallback: Use default salary
    console.warn(`[Payroll] No salary found for employee ${employeeCode}, using default ₹50,000`);
    return {
      baseSalary: 50000, // Default salary
      hourlyRate: 0,
    };
  } catch (err) {
    const error = err as Error;
    console.error(`[Payroll] ❌ Error loading salary for employee ${userId}:`, error.message);
    // Return default instead of throwing
    console.warn(`[Payroll] Using default salary ₹50,000 for employee ${userId}`);
    return {
      baseSalary: 50000,
      hourlyRate: 0,
    };
  }
}

/**
 * Count payable Sundays within a specific date range
 * This function now counts Sundays based on their weekoffType in the daily breakdown,
 * which already has the sandwich rule applied in calculateMonthlyHours
 */
function countPayableSundaysRange(start: string, end: string, dailyBreakdown: DailyBreakdown[]): number {
  let payableSundayCount = 0;
  
  // Use date-fns for accurate date iteration and day-of-week detection
  const allDates = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end)
  });


  for (const currentDate of allDates) {
    const dayOfWeek = getDay(currentDate); // 0 = Sunday
    
    if (dayOfWeek === 0) { // Sunday
      // Use the same formatDate function that's used in daily breakdown creation
      const dateStr = formatDate(currentDate);
      
      // Find the corresponding day entry in daily breakdown
      const dayEntry = dailyBreakdown.find(d => d.date === dateStr);
      
      // Count as payable if it's a weekoff with paid type
      if (dayEntry && dayEntry.status === 'weekoff') {
        const weekoffType = (dayEntry as any).weekoffType;
        if (weekoffType === 'paid') {
          payableSundayCount++;
          console.log(`[Payroll] ✅ Sunday ${dateStr} counted as PAID`);
        } else {
          console.log(`[Payroll] ❌ Sunday ${dateStr} NOT paid (weekoffType: ${weekoffType})`);
        }
      } else if (!dayEntry) {
        // If Sunday is in effective range but not found in daily breakdown, 
        // it might be outside the cycle range - log for debugging
        console.log(`[Payroll] ⚠️ Sunday ${dateStr} in effective range but not found in daily breakdown`);
        // Check if it exists with different status
        const entryWithDifferentStatus = dailyBreakdown.find(d => d.date === dateStr);
        if (entryWithDifferentStatus) {
          console.log(`[Payroll]   Found entry with status: ${entryWithDifferentStatus.status}`);
        }
      } else {
        // Entry exists but status is not 'weekoff'
        console.log(`[Payroll] ⚠️ Sunday ${dateStr} found but status is '${dayEntry.status}' (expected 'weekoff')`);
      }
    }
  }
  
  return payableSundayCount;
}

/**
 * Calculate salary for an employee for a given month
 * 
 * Data Sources:
 * - Employee Name/Code: Employees table (database)
 * - Base Salary: Excel file (legacy)
 * - Attendance: Biometric database
 * - Leave Approvals: MonthlyLeaveUsage table (database) - persisted across sessions
 * 
 * Business Rules:
 * - Paid Leave = FULL DAY (1.0 day credit)
 * - Casual Leave = HALF DAY (0.5 day credit)
 * - Leave approvals fetched from database if not provided as parameters
 * - Loss of Pay (LOP) applied if leaves exceed annual entitlement
 */
export async function calculateSalary(
  employeeNo: number | string,
  month: string,
  joinDateStr?: string,
  exitDateStr?: string,
  paidLeaveDates?: LeaveDateWithValue[] | string[],
  casualLeaveDates?: LeaveDateWithValue[] | string[]
): Promise<SalaryCalculation> {
  // Normalize leave dates to LeaveDateWithValue[] format
  // Handle both string[] (legacy) and LeaveDateWithValue[] (new format)
  const normalizeLeaveDates = (dates: LeaveDateWithValue[] | string[] | undefined, defaultValue: number): LeaveDateWithValue[] => {
    if (!dates || dates.length === 0) return [];
    
    // Check if it's already in new format
    if (dates.length > 0 && typeof dates[0] === 'object' && 'date' in dates[0] && 'value' in dates[0]) {
      return dates as LeaveDateWithValue[];
    }
    
    // Convert from string[] to LeaveDateWithValue[]
    return (dates as string[]).map(date => ({ date, value: defaultValue }));
  };
  
  // Normalize both arrays
  let normalizedPaidLeaves: LeaveDateWithValue[] | undefined = paidLeaveDates ? normalizeLeaveDates(paidLeaveDates, 1.0) : undefined;
  let normalizedCasualLeaves: LeaveDateWithValue[] | undefined = casualLeaveDates ? normalizeLeaveDates(casualLeaveDates, 0.5) : undefined;
  // Get employee details from Employees table (NOT from Excel)
  const { EmployeeModel } = await import('../models/EmployeeModel.js');
  const employee = await EmployeeModel.getByCode(employeeNo.toString());
  
  if (!employee) {
    throw new Error(`Employee with code ${employeeNo} not found in Employees table`);
  }

  // Fetch join date from EmployeeDetails if not provided
  if (!joinDateStr) {
    try {
      const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeNo.toString());
      if (employeeDetails?.JoiningDate) {
        // JoiningDate is already formatted as YYYY-MM-DD string from EmployeeDetailsModel
        joinDateStr = employeeDetails.JoiningDate;
        console.log(`[Payroll] Join date: ${joinDateStr}`);
      }
    } catch (err) {
      console.warn(`[Payroll] Could not fetch join date from EmployeeDetails: ${(err as Error).message}`);
    }
  } else {
  }

  // Use normalized leave dates
  paidLeaveDates = normalizedPaidLeaves;
  casualLeaveDates = normalizedCasualLeaves;
  
  // If leave dates not provided as parameters, try to fetch from database (persistent storage)
  // This allows salary to be recalculated later with the same leave approvals
  // IMPORTANT: Only fetch from database if parameters are not provided
  // If parameters are explicitly provided (even if empty arrays), use those instead
  // NOTE: We need to load leave dates BEFORE calling calculateMonthlyHours so they can be
  // used to correctly calculate Sunday payment and absent counts
  if (paidLeaveDates === undefined || casualLeaveDates === undefined) {
    try {
      const { LeaveModel } = await import('../models/LeaveModel.js');
      const monthlyLeaveUsage = await LeaveModel.getMonthlyLeaveUsage(employeeNo.toString(), month);
      
      if (monthlyLeaveUsage) {
        // Parse leave dates with values (supports both JSON and legacy format)
        const { parseLeaveDatesWithValues } = await import('./leaveService.js');
        paidLeaveDates = paidLeaveDates === undefined ? parseLeaveDatesWithValues(monthlyLeaveUsage.PaidLeaveDates, 1.0) : paidLeaveDates;
        casualLeaveDates = casualLeaveDates === undefined ? parseLeaveDatesWithValues(monthlyLeaveUsage.CasualLeaveDates, 0.5) : casualLeaveDates;
        
        const paidCount = paidLeaveDates?.length || 0;
        const casualCount = casualLeaveDates?.length || 0;
        if (paidCount > 0 || casualCount > 0) {
          console.log(`[Payroll] Leave dates loaded: ${paidCount} paid, ${casualCount} casual`);
        }
      } else {
        paidLeaveDates = paidLeaveDates === undefined ? [] : paidLeaveDates;
        casualLeaveDates = casualLeaveDates === undefined ? [] : casualLeaveDates;
      }
    } catch (err) {
      console.warn(`[Payroll] Could not fetch leave approvals (table may not exist yet): ${(err as Error).message}`);
      paidLeaveDates = paidLeaveDates === undefined ? [] : paidLeaveDates;
      casualLeaveDates = casualLeaveDates === undefined ? [] : casualLeaveDates;
    }
  } else {
    // Leave dates were explicitly provided as parameters
    // IMPORTANT: Use provided values as-is - frontend is the source of truth
    // The frontend loads data from DB first, then user makes changes, so provided values are always current
    // Don't merge with DB - this prevents stale data issues
  }

  // Get attendance data from database
  // IMPORTANT: Pass leave dates so they can be factored into Sunday payment and absent count calculations
  console.log(`[Payroll] Calculating salary for ${employee.EmployeeName} (${employeeNo}) - ${month}`);
  const attendance = await calculateMonthlyHours(employeeNo, month, joinDateStr, exitDateStr, paidLeaveDates, casualLeaveDates);

  // Get base salary from Excel file (ONLY salary data, not employee identity)
  const { baseSalary, hourlyRate } = await getBaseSalary(employeeNo);
  console.log(`[Payroll] Base salary: ₹${baseSalary.toLocaleString('en-IN')}, Hourly rate: ₹${hourlyRate?.toFixed(2) || 'N/A'}`);

  // Get the default salary cycle date range (26th to 25th)
  const { start, end } = getMonthRange(month);
  
  // Effective range based on joining/exit dates
  const effectiveStart = joinDateStr && joinDateStr > start ? joinDateStr : start;
  const effectiveEnd = exitDateStr && exitDateStr < end ? exitDateStr : end;

  const startDate = createLocalDate(effectiveStart);
  const endDate = createLocalDate(effectiveEnd);
  const diffMs = endDate.getTime() - startDate.getTime();
  
  // Fetch employee details (for shift timing and cleaner check)
  let employeeDetails: any = null;
  let workHoursPerDay = config.defaultWorkHoursPerDay; // Default fallback
  try {
    const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
    const { ShiftModel } = await import('../models/ShiftModel.js');
    
    employeeDetails = await EmployeeDetailsModel.getByCode(employeeNo.toString());
    if (employeeDetails?.Shift) {
      const shift = await ShiftModel.getByName(employeeDetails.Shift);
      if (shift) {
        workHoursPerDay = shift.WorkHours;
      }
    } else {
      // Try default shift
      const defaultShift = await ShiftModel.getDefaultShift();
      if (defaultShift) {
        workHoursPerDay = defaultShift.WorkHours;
      }
    }
    console.log(`[Payroll] Work hours: ${workHoursPerDay}h/day`);
  } catch (error: any) {
    console.warn(`[Payroll] Could not fetch employee details/shift for work hours, using default ${workHoursPerDay} hours: ${error.message}`);
  }
  
  // expectedWorkingDays is the number of days the employee was actually active in this cycle
  const expectedWorkingDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
  const expectedHours = expectedWorkingDays * workHoursPerDay;

  // Calculate per-day and per-hour rates based on the FULL cycle length (usually 30 or 31)
  // so the employee gets their proportionate share of the monthly salary.
  const fullCycleStartDate = createLocalDate(start);
  const fullCycleEndDate = createLocalDate(end);
  const fullCycleDiffMs = fullCycleEndDate.getTime() - fullCycleStartDate.getTime();
  const fullCycleDays = Math.round(fullCycleDiffMs / (1000 * 60 * 60 * 24)) + 1;
  
  const perDayRate = baseSalary / fullCycleDays;
  const calculatedHourlyRate = hourlyRate || (baseSalary / (fullCycleDays * workHoursPerDay));

  // Count payable Sundays within the EFFECTIVE range
  const payableSundays = countPayableSundaysRange(effectiveStart, effectiveEnd, attendance.dailyBreakdown);

  // Calculate approved leave days using explicit values (0.5 or 1.0)
  // IMPORTANT: After processing in calculateMonthlyHours, paid leave days are marked as 'paid-leave' status
  // and casual leave days are marked as 'casual-leave' status, so we need to check for these statuses too
  let paidLeaveDays = 0;
  let casualLeaveDays = 0;
  
  if (paidLeaveDates && paidLeaveDates.length > 0) {
    // Sum up explicit values for eligible dates
    paidLeaveDays = paidLeaveDates.reduce((sum, leaveItem) => {
      const dayEntry = attendance.dailyBreakdown.find(d => d.date === leaveItem.date);
      
      // Count as paid leave if:
      // 1. Day entry exists
      // 2. Status is 'paid-leave' (after processing), OR 'absent'/'half-day' (before processing)
      // 3. Day is within effective range (not 'not-active')
      const isEligible = dayEntry && 
                        dayEntry.status !== 'not-active' &&
                        (dayEntry.status === 'paid-leave' || 
                         dayEntry.status === 'absent' || 
                         dayEntry.status === 'half-day');
      
      if (!isEligible && dayEntry) {
        console.log(`[Payroll] Paid leave date ${leaveItem.date} is not eligible (status: ${dayEntry.status})`);
      } else if (!dayEntry) {
        console.log(`[Payroll] Paid leave date ${leaveItem.date} not found in daily breakdown`);
      }
      
      // Ensure value exists and is valid
      const value = (leaveItem.value === 0.5 || leaveItem.value === 1.0) ? leaveItem.value : 1.0;
      return isEligible ? sum + value : sum;
    }, 0);
    
    
  }
  
  if (casualLeaveDates && casualLeaveDates.length > 0) {
    // Sum up explicit values for eligible dates
    casualLeaveDays = casualLeaveDates.reduce((sum, leaveItem) => {
      const dayEntry = attendance.dailyBreakdown.find(d => d.date === leaveItem.date);
      
      // Count as casual leave if:
      // 1. Day entry exists
      // 2. Status is 'casual-leave' (after processing), OR 'absent'/'half-day' (before processing)
      // 3. Day is within effective range (not 'not-active')
      const isEligible = dayEntry && 
                        dayEntry.status !== 'not-active' &&
                        (dayEntry.status === 'casual-leave' || 
                         dayEntry.status === 'absent' || 
                         dayEntry.status === 'half-day');
      
      if (!isEligible && dayEntry) {
        console.log(`[Payroll] Casual leave date ${leaveItem.date} is not eligible (status: ${dayEntry.status})`);
      } else if (!dayEntry) {
        console.log(`[Payroll] Casual leave date ${leaveItem.date} not found in daily breakdown`);
      }
      
      // Ensure value exists and is valid
      const value = (leaveItem.value === 0.5 || leaveItem.value === 1.0) ? leaveItem.value : 1.0;
      return isEligible ? sum + value : sum;
    }, 0);
    
    
  }

  // Check leave entitlement and calculate Loss of Pay (LOP)
  // This is optional - if EmployeeLeaves table is empty or doesn't exist, skip this check
  const year = parseInt(month.split('-')[0], 10);
  let lossOfPayDays = 0;
  let leaveInfo = null;
  
  try {
    const { LeaveModel } = await import('../models/LeaveModel.js');
    const leaveEntitlement = await LeaveModel.getEmployeeLeaveEntitlement(employeeNo.toString(), year);
    
    if (leaveEntitlement) {
      const totalUsedLeaves = leaveEntitlement.UsedPaidLeaves + leaveEntitlement.UsedCasualLeaves;
      const isExceeded = totalUsedLeaves > leaveEntitlement.AllowedLeaves;
      lossOfPayDays = isExceeded ? (totalUsedLeaves - leaveEntitlement.AllowedLeaves) : 0;
      
      leaveInfo = {
        allowedLeaves: leaveEntitlement.AllowedLeaves,
        usedPaidLeaves: leaveEntitlement.UsedPaidLeaves,
        usedCasualLeaves: leaveEntitlement.UsedCasualLeaves,
        remainingLeaves: Math.max(0, leaveEntitlement.AllowedLeaves - totalUsedLeaves),
        isExceeded,
        lossOfPayDays,
      };
      
      if (isExceeded) {
      }
    } else {
      console.log(`[Payroll] No leave entitlement configured for employee ${employee.EmployeeName} in year ${year}`);
    }
  } catch (err) {
    console.warn(`[Payroll] Could not check leave entitlement (table may not be configured): ${(err as Error).message}`);
    // Continue without leave checking - this is optional functionality
  }

  // Calculate payable salary based on ACTUAL DAYS PRESENT + PAYABLE SUNDAYS + APPROVED LEAVES - LOP
  const actualDaysWorked = attendance.fullDays + (attendance.halfDays * 0.5);
  
  // Calculate leave credits based on explicit values (not implicit assumptions)
  // Use the calculated paidLeaveDays and casualLeaveDays (which already account for eligibility)
  // instead of summing all dates (some might not be eligible)
  const approvedLeaveDays = paidLeaveDays + casualLeaveDays;
  
  const lopDeduction = lossOfPayDays * perDayRate;
  const totalPayableDays = actualDaysWorked + payableSundays + approvedLeaveDays;
  const payableBasedOnAttendance = (perDayRate * totalPayableDays) - lopDeduction;
  
  console.log(`[Payroll] Attendance summary: ${attendance.fullDays} full + ${attendance.halfDays} half days, ${attendance.absentDays} absent, ${attendance.lateDays} late, ${payableSundays} payable Sundays`);
  console.log(`[Payroll] Leave credits: ${paidLeaveDays} paid + ${casualLeaveDays} casual = ${approvedLeaveDays} days`);
  console.log(`[Payroll] Payable: ${totalPayableDays} days × ₹${perDayRate.toFixed(2)} = ₹${payableBasedOnAttendance.toFixed(2)}${lossOfPayDays > 0 ? ` - LOP ₹${lopDeduction.toFixed(2)}` : ''}`);
  

  // Calculate deductions for late entries
  // Separate 30+ min late days and 10+ min late days (but not 30+ min)
  // These variables are kept for code clarity and potential future use in late deduction calculations
  const lateBy30MinutesDays = attendance.lateBy30MinutesDays || 0;
  const totalLateDays = attendance.lateDays || 0;
  
  // 30+ minute late deduction: 50% per day (only if completed full hours)
  // 10+ minute late deduction: 25% per day for days exceeding grace period (3 days)
  // Grace period applies only to 10+ min late days (not 30+ min late days)
  // Note: Late deductions are applied directly in salary calculation, not stored separately
  // TODO: If late deduction calculations are uncommented, use these variables:
  // const lateDeduction30Minutes = lateBy30MinutesDays * (perDayRate * 0.5);
  // const lateBy10MinutesDays = Math.max(0, totalLateDays - lateBy30MinutesDays);
  // const lateDays10MinExceedingGrace = Math.max(0, lateBy10MinutesDays - 3);
  // const lateDeduction10Minutes = lateDays10MinExceedingGrace * (perDayRate * 0.25);
  

  // Calculate overtime (per day, not monthly)
  // First check if overtime is enabled for this employee for this month
  let isOvertimeEnabled = false;
  let overtimeHours = 0;
  let overtimeAmount = 0;
  
  try {
    const { MonthlyOTModel } = await import('../models/MonthlyOTModel.js');
    const overtimeStatus = await MonthlyOTModel.getOvertimeStatus(employeeNo.toString(), month);
    isOvertimeEnabled = overtimeStatus?.IsOvertimeEnabled || false;
    
    if (isOvertimeEnabled) {
      // Calculate overtime per day
      const rawOvertimeHours = calculateOvertimePerDay(attendance.dailyBreakdown, workHoursPerDay);
      // Round down to nearest whole hour (floor)
      overtimeHours = Math.floor(rawOvertimeHours);
      overtimeAmount = overtimeHours * calculatedHourlyRate;
      console.log(`[Payroll] Overtime: ${overtimeHours}h × ₹${calculatedHourlyRate.toFixed(2)} = ₹${overtimeAmount.toFixed(2)}`);
    }
  } catch (err) {
    console.warn(`[Payroll] Could not check overtime status (table may not exist): ${(err as Error).message}`);
    // Overtime disabled by default if table doesn't exist
  }

  // Note: totalDeductions calculated later when adjustments are fetched


  // Calculate initial gross salary (includes overtime, but NOT incentive yet)
  // We'll add incentive later after fetching adjustments
  const grossSalaryBase = parseFloat((payableBasedOnAttendance + overtimeAmount).toFixed(2));
  console.log(`[Payroll] Gross salary (base): ₹${grossSalaryBase.toFixed(2)} (attendance: ₹${payableBasedOnAttendance.toFixed(2)} + overtime: ₹${overtimeAmount.toFixed(2)})`);

  // Calculate TDS threshold
  const tdsThreshold = 15000;
  
  // Calculate Professional Tax: ₹200 if gross salary > 12000 AND base salary >= 15000
  // Professional Tax is calculated based on both gross salary and base salary thresholds
  const professionalTaxThreshold = 15000;
  const professionalTaxGrossThreshold = 12000;
  let professionalTax = 0;
  if (grossSalaryBase > professionalTaxGrossThreshold && baseSalary >= professionalTaxThreshold) {
    professionalTax = 200;
    console.log(`[Payroll] Professional tax: ₹${professionalTax}`);
  }

  // Fetch salary adjustments (deductions and additions)
  let totalAdjustmentDeductions = 0;
  let totalAdjustmentAdditions = 0;
  let incentiveAmount = 0; // Incentive is added to gross salary, not net salary
  let adjustmentDetails: Array<{ type: string; category: string; amount: number; description?: string }> = [];
  
  try {
    const { SalaryAdjustmentModel } = await import('../models/SalaryAdjustmentModel.js');
    const adjustmentSummary = await SalaryAdjustmentModel.getAdjustmentSummary(employeeNo.toString(), month);
    
    // Separate incentive from other additions (incentive goes to gross salary)
    const incentiveAdjustment = adjustmentSummary.adjustments.find(
      adj => adj.Type === 'ADDITION' && adj.Category === 'INCENTIVE'
    );
    incentiveAmount = incentiveAdjustment ? incentiveAdjustment.Amount : 0;
    
    // Calculate other adjustments (excluding incentive)
    totalAdjustmentDeductions = adjustmentSummary.adjustments
      .filter(adj => adj.Type === 'DEDUCTION')
      .reduce((sum, adj) => sum + adj.Amount, 0);
    
    totalAdjustmentAdditions = adjustmentSummary.adjustments
      .filter(adj => adj.Type === 'ADDITION' && adj.Category !== 'INCENTIVE')
      .reduce((sum, adj) => sum + adj.Amount, 0);
    
    // Store adjustment details for breakdown (including incentive for display)
    adjustmentDetails = adjustmentSummary.adjustments.map(adj => ({
      type: adj.Type,
      category: adj.Category,
      amount: adj.Amount,
      description: adj.Description || undefined,
    }));
    
    if (incentiveAmount > 0 || totalAdjustmentDeductions > 0 || totalAdjustmentAdditions > 0) {
      console.log(`[Payroll] Adjustments: ${incentiveAmount > 0 ? `+Incentive ₹${incentiveAmount.toFixed(2)} ` : ''}${totalAdjustmentDeductions > 0 ? `-Deductions ₹${totalAdjustmentDeductions.toFixed(2)} ` : ''}${totalAdjustmentAdditions > 0 ? `+Additions ₹${totalAdjustmentAdditions.toFixed(2)}` : ''}`);
    }
    
    if (totalAdjustmentDeductions > 0 || totalAdjustmentAdditions > 0 || incentiveAmount > 0) {
      console.log(`[Payroll] Salary adjustments for employee ${employeeNo} (${month}):`);
      console.log(`[Payroll]   - Incentive (added to gross): ₹${incentiveAmount.toFixed(2)}`);
      console.log(`[Payroll]   - Total deductions: ₹${totalAdjustmentDeductions.toFixed(2)}`);
      console.log(`[Payroll]   - Total additions (excluding incentive): ₹${totalAdjustmentAdditions.toFixed(2)}`);
      adjustmentDetails.forEach(adj => {
        console.log(`[Payroll]   - ${adj.type} (${adj.category}): ₹${adj.amount.toFixed(2)}${adj.description ? ` - ${adj.description}` : ''}`);
      });
    }
  } catch (err) {
    console.warn(`[Payroll] Could not fetch salary adjustments (table may not exist yet): ${(err as Error).message}`);
    // Continue without adjustments if table doesn't exist
  }

  // Calculate gross salary (includes overtime AND incentive)
  // Incentive is added to gross salary, so it affects TDS and Professional Tax calculations
  const grossSalaryWithIncentive = parseFloat(
    (payableBasedOnAttendance + overtimeAmount + incentiveAmount).toFixed(2)
  );

  // Calculate cumulative salary from joining date to current month
  // TDS is deducted only if: baseSalary < ₹15,000 AND cumulative salary >= ₹50,000
  // IMPORTANT: Count salary cycles (26th to 25th), not calendar months
  let cumulativeSalary = 0;
  const cumulativeSalaryThreshold = 50000;
  
  
  if (joinDateStr && baseSalary < tdsThreshold) {
    try {
      // Parse joining date
      const joinDate = createLocalDate(joinDateStr);
      const joinDay = joinDate.getDate();
      
      // Get the salary cycle range for the current month
      // Example: month "2025-02" means cycle Jan 26 - Feb 25
      const currentCycleRange = getMonthRange(month);
      const currentCycleStart = createLocalDate(currentCycleRange.start);
      
      // Determine which salary cycle the join date falls into
      // Salary cycles run from 26th of one month to 25th of next month
      // Example: Jan 26 - Feb 25 is the cycle for "2025-02" month
      let joinCycleStart: Date;
      
      if (joinDay >= 26) {
        // Joined on or after 26th: belongs to cycle starting on join date's 26th
        // Cycle: joinMonth 26th to (joinMonth+1) 25th
        joinCycleStart = new Date(joinDate.getFullYear(), joinDate.getMonth(), 26);
      } else {
        // Joined before 26th: belongs to previous cycle
        // Cycle: (joinMonth-1) 26th to joinMonth 25th
        joinCycleStart = new Date(joinDate.getFullYear(), joinDate.getMonth() - 1, 26);
      }
      
      // Count salary cycles from join cycle to current cycle (inclusive)
      // We count all cycles from the join cycle up to and including the current cycle
      // The current cycle counts even if it hasn't ended yet (we're calculating salary for it)
      let cyclesCount = 0;
      
      // Calculate the difference in months between join cycle and current cycle
      // Each cycle spans approximately one month (26th to 25th)
      const joinCycleYear = joinCycleStart.getFullYear();
      const joinCycleMonth = joinCycleStart.getMonth(); // 0-11
      const currentCycleYear = currentCycleStart.getFullYear();
      const currentCycleMonth = currentCycleStart.getMonth(); // 0-11
      
      // Calculate months difference
      const yearDiff = currentCycleYear - joinCycleYear;
      const monthDiff = currentCycleMonth - joinCycleMonth;
      const totalMonthsDiff = (yearDiff * 12) + monthDiff;
      
      // Number of cycles = months difference + 1 (inclusive of both cycles)
      cyclesCount = totalMonthsDiff + 1;
      
      // Ensure cyclesCount is at least 1 (even if join and current are in same cycle)
      if (cyclesCount < 1) {
        cyclesCount = 1;
      }
      
      // Calculate cumulative salary: baseSalary × number of completed cycles
      // This represents total salary that would have been paid if employee worked full cycles
      cumulativeSalary = baseSalary * cyclesCount;
      
    } catch (err) {
      console.warn(`[Payroll] Could not calculate cumulative salary: ${(err as Error).message}`);
      cumulativeSalary = 0; // If calculation fails, don't deduct TDS
    }
  }

  // Check if employee is a cleaner (Department or Designation contains "Clean")
  // Cleaners are exempt from TDS deduction
  let isCleaner = false;
  try {
    if (employeeDetails) {
      const department = (employeeDetails.Department || '').toUpperCase();
      const designation = (employeeDetails.Designation || '').toUpperCase();
      isCleaner = department.includes('CLEAN') || designation.includes('CLEAN');
      
      if (isCleaner) {
      }
    }
  } catch (err) {
    console.warn(`[Payroll] Could not check cleaner status: ${(err as Error).message}`);
    // If check fails, proceed with normal TDS calculation
  }

  // Recalculate TDS based on gross salary WITH incentive
  // TDS is deducted only if:
  // 1. Monthly base salary < ₹15,000
  // 2. Cumulative salary from joining date >= ₹50,000
  // 3. Employee is NOT a cleaner (Department or Designation does NOT contain "Clean")
  let tdsDeductionWithIncentive = 0;
  if (grossSalaryWithIncentive > 0 && baseSalary < tdsThreshold && cumulativeSalary >= cumulativeSalaryThreshold && !isCleaner) {
    tdsDeductionWithIncentive = parseFloat((grossSalaryWithIncentive * 0.1).toFixed(2));
    console.log(`[Payroll] TDS: ₹${tdsDeductionWithIncentive.toFixed(2)} (10% of gross ₹${grossSalaryWithIncentive.toFixed(2)})`);
  }

  // Calculate final net salary after TDS, Professional Tax, and Salary Adjustments
  // Net salary = Gross salary (with overtime + incentive) - TDS (recalculated) - Professional Tax - Adjustment Deductions + Adjustment Additions
  // Round to nearest integer (e.g., 2345.6 → 2346, 1235.1 → 1235)
  const netSalary = Math.round(
    grossSalaryWithIncentive - tdsDeductionWithIncentive - professionalTax - totalAdjustmentDeductions + totalAdjustmentAdditions
  );
  
  console.log(`[Payroll] Final: Gross ₹${grossSalaryWithIncentive.toFixed(2)} - TDS ₹${tdsDeductionWithIncentive.toFixed(2)} - PT ₹${professionalTax} - Deductions ₹${totalAdjustmentDeductions.toFixed(2)} + Additions ₹${totalAdjustmentAdditions.toFixed(2)} = Net ₹${netSalary.toFixed(2)}`);

  // // Update total deductions to include TDS and Professional Tax
  // const totalDeductionsWithTDS = parseFloat(
  //   (totalDeductions + tdsDeduction + professionalTax).toFixed(2)
  // );

    // Update total deductions to include TDS (recalculated with incentive), Professional Tax, and Adjustment Deductions
    const totalDeductionsWithTDS = parseFloat(
      (tdsDeductionWithIncentive + professionalTax + totalAdjustmentDeductions).toFixed(2)
    );

  return {
    employeeCode: employeeNo.toString(),
    employeeName: employee.EmployeeName, // From Employees table
    month,
    baseSalary: parseFloat(baseSalary.toFixed(2)),
    grossSalary: grossSalaryWithIncentive, // Gross salary includes overtime AND incentive
    netSalary, // Net salary = Gross (with incentive) - TDS (recalculated) - Professional Tax - Adjustment Deductions + Adjustment Additions
    attendance: {
      totalDays: attendance.totalDaysInMonth,
      expectedWorkingDays,
      fullDays: attendance.fullDays,
      halfDays: attendance.halfDays,
      absentDays: attendance.absentDays,
      lateDays: attendance.lateDays,
      lateBy30MinutesDays: lateBy30MinutesDays,
      lateBy10MinutesDays: Math.max(0, totalLateDays - lateBy30MinutesDays), // 10+ min but not 30+ min
      earlyExits: attendance.earlyExits,
      totalWorkedHours: attendance.totalWorkedHours,
      expectedHours,
      overtimeHours: isOvertimeEnabled ? overtimeHours : 0,
      isOvertimeEnabled,
      sundaysInMonth: payableSundays,
      actualDaysWorked,
      totalPayableDays,
      // Include dailyBreakdown with updated weekoff payment status
      dailyBreakdown: attendance.dailyBreakdown,
    },
    breakdown: {
      perDayRate: parseFloat(perDayRate.toFixed(2)),
      hourlyRate: parseFloat(calculatedHourlyRate.toFixed(2)),
      absentDeduction: parseFloat(((expectedWorkingDays - totalPayableDays) * perDayRate).toFixed(2)),
      halfDayDeduction: parseFloat((attendance.halfDays * perDayRate * 0.5).toFixed(2)),
      // lateDeduction: parseFloat(lateDeduction.toFixed(2)), // Total late deduction
      // lateDeduction30Minutes: parseFloat(lateDeduction30Minutes.toFixed(2)), // 50% deduction for late by 30+ minutes
      // lateDeduction10Minutes: parseFloat(lateDeduction10Minutes.toFixed(2)), // 25% deduction for 10+ min late days exceeding grace period
      totalDeductions: totalDeductionsWithTDS,
      overtimeAmount: parseFloat(overtimeAmount.toFixed(2)),
      sundayPay: parseFloat((payableSundays * perDayRate).toFixed(2)),
      lopDeduction: parseFloat(lopDeduction.toFixed(2)), // Loss of Pay deduction
      tdsDeduction: tdsDeductionWithIncentive > 0 ? parseFloat(tdsDeductionWithIncentive.toFixed(2)) : undefined, // TDS deduction (recalculated with incentive, only if applicable)
      professionalTax: professionalTax > 0 ? parseFloat(professionalTax.toFixed(2)) : undefined, // Professional tax (only if applicable)
      incentiveAmount: incentiveAmount > 0 ? parseFloat(incentiveAmount.toFixed(2)) : undefined, // Incentive (added to gross salary, only if applicable)
      adjustmentDeductions: totalAdjustmentDeductions > 0 ? parseFloat(totalAdjustmentDeductions.toFixed(2)) : undefined, // Salary adjustment deductions (only if applicable)
      adjustmentAdditions: totalAdjustmentAdditions > 0 ? parseFloat(totalAdjustmentAdditions.toFixed(2)) : undefined, // Salary adjustment additions (excluding incentive, only if applicable)
      adjustmentDetails: adjustmentDetails.length > 0 ? adjustmentDetails : undefined, // Detailed adjustment breakdown
    },
    leaveInfo: leaveInfo || undefined, // Leave balance information
  };
}

