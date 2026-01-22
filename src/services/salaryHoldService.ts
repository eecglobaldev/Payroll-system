/**
 * Salary Hold Service
 * Business logic for automatic salary hold functionality
 */

import { SalaryHoldModel } from '../models/SalaryHoldModel.js';
import { AttendanceModel } from '../models/AttendanceModel.js';
import { formatDate, createLocalDate } from '../utils/date.js';
import { getDay } from 'date-fns';

/**
 * Get next month from a given month string (YYYY-MM)
 * @param monthStr - Month string in YYYY-MM format
 * @returns Next month in YYYY-MM format
 */
function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  let nextYear = year;
  let nextMonth = month + 1;
  
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Check if employee is absent on dates 1-5 of next month
 * @param employeeCode - Employee code
 * @param currentMonth - Current month in YYYY-MM format
 * @returns Array of absent dates (YYYY-MM-DD format)
 */
async function checkAbsentOnNextMonthFirstFive(
  employeeCode: string,
  currentMonth: string
): Promise<string[]> {
  const nextMonth = getNextMonth(currentMonth);
  const [year, month] = nextMonth.split('-').map(Number);
  
  // Get dates 1-5 of next month
  const checkDates: string[] = [];
  for (let day = 1; day <= 5; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = formatDate(date);
    checkDates.push(dateStr);
  }
  
  const userId = parseInt(employeeCode, 10);
  if (isNaN(userId)) {
    console.warn(`[SalaryHoldService] Invalid employee code: ${employeeCode}`);
    return [];
  }
  
  // Get attendance logs for dates 1-5
  const startDate = checkDates[0];
  const endDate = checkDates[checkDates.length - 1];
  
  const logs = await AttendanceModel.getByEmployeeAndDateRange(
    userId,
    startDate,
    endDate
  );
  
  // Group logs by date
  const logsByDate: Record<string, any[]> = {};
  logs.forEach(log => {
    const logDate = formatDate(new Date(log.LogDate));
    if (!logsByDate[logDate]) {
      logsByDate[logDate] = [];
    }
    logsByDate[logDate].push(log);
  });
  
  // Check each date for absence
  const absentDates: string[] = [];
  
  for (const dateStr of checkDates) {
    const dayLogs = logsByDate[dateStr] || [];
    
    // Check if it's a Sunday (weekoff) - Sundays don't count as absent
    const date = createLocalDate(dateStr);
    const isSunday = getDay(date) === 0;
    
    if (isSunday) {
      // Skip Sundays
      continue;
    }
    
    // If no logs for this day, employee is absent
    // We use a simple check: if no logs exist, it's absent
    // This is sufficient for the auto-hold logic (checking dates 1-5)
    if (dayLogs.length === 0) {
      absentDates.push(dateStr);
      console.log(`[SalaryHoldService] Employee ${employeeCode} is absent on ${dateStr} (next month date 1-5)`);
    } else {
      // If logs exist, calculate day hours to check status
      // Use dynamic import to avoid circular dependency issues
      const { calculateDayHours } = await import('./payroll.js');
      const dayStats = calculateDayHours(dayLogs);
      
      if (dayStats.status === 'absent') {
        absentDates.push(dateStr);
        console.log(`[SalaryHoldService] Employee ${employeeCode} is absent on ${dateStr} (next month date 1-5)`);
      }
    }
  }
  
  return absentDates;
}

/**
 * Check and create automatic salary hold if employee is absent on 1-5 of next month
 * This function should be called during salary summary generation
 * @param employeeCode - Employee code
 * @param currentMonth - Current month in YYYY-MM format (the month being processed)
 * @returns Created hold record or null if no hold needed
 */
export async function checkAndCreateAutoHold(
  employeeCode: string,
  currentMonth: string
): Promise<any | null> {
  try {
    // Check if hold already exists for next month
    const nextMonth = getNextMonth(currentMonth);
    const existingHold = await SalaryHoldModel.isSalaryHeld(employeeCode, nextMonth);
    
    if (existingHold) {
      // Hold already exists, no need to check again
      console.log(`[SalaryHoldService] Hold already exists for employee ${employeeCode} in ${nextMonth}`);
      return existingHold;
    }
    
    // Check attendance for dates 1-5 of next month
    const absentDates = await checkAbsentOnNextMonthFirstFive(employeeCode, currentMonth);
    
    if (absentDates.length > 0) {
      // Employee is absent on at least one day in 1-5 of next month
      // Create AUTO hold for next month
      const reason = `Automatic hold: Absent on ${absentDates.join(', ')} (dates 1-5 of next month)`;
      
      console.log(`[SalaryHoldService] Creating AUTO hold for employee ${employeeCode} in ${nextMonth} - Absent on: ${absentDates.join(', ')}`);
      
      const hold = await SalaryHoldModel.createHold({
        employeeCode,
        month: nextMonth,
        holdType: 'AUTO',
        reason,
        actionBy: 'SYSTEM',
      });
      
      return hold;
    }
    
    // No absent days found, no hold needed
    return null;
  } catch (error: any) {
    console.error(`[SalaryHoldService] Error checking auto-hold for employee ${employeeCode}:`, error.message);
    // Don't throw - this is a background check, shouldn't break salary calculation
    return null;
  }
}

