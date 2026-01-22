/**
 * Leave Service
 * Business logic for leave management
 * 
 * Key Responsibilities:
 * 1. Validate leave approvals against entitlements
 * 2. Save/update monthly leave usage (persists across sessions)
 * 3. Calculate leave balances
 * 4. Integrate with salary calculation
 * 
 * Business Rules:
 * - Paid Leave = FULL DAY (no salary deduction)
 * - Casual Leave = HALF DAY (0.5 day credit)
 * - AllowedLeaves from EmployeeLeaves table is the annual limit
 * - Exceeding limit results in Loss of Pay (LOP)
 */

import { LeaveModel } from '../models/LeaveModel.js';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { getMonthRange, createLocalDate } from '../utils/date.js';
import {
  SaveLeaveApprovalRequest,
  LeaveBalance,
  MonthlyLeaveUsage,
  LeaveDateWithValue,
} from '../types/index.js';

/**
 * Save or update monthly leave approvals for an employee
 * This persists the leave data so it survives page refreshes
 */
export async function saveMonthlyLeaveApproval(
  data: SaveLeaveApprovalRequest
): Promise<{
  success: boolean;
  operation: string;
  leaveBalance: LeaveBalance;
  monthlyUsage: MonthlyLeaveUsage;
}> {
  const { employeeCode, month } = data;

  // Extract year from month string (e.g., '2025-11' -> 2025)
  const year = parseInt(month.split('-')[0], 10);

  // Validate: Check if employee exists
  const employee = await EmployeeModel.getByCode(employeeCode);
  if (!employee) {
    throw new Error(`Employee with code ${employeeCode} not found`);
  }

  // Check leave entitlement (optional - don't block if not configured)
  const entitlement = await LeaveModel.getEmployeeLeaveEntitlement(employeeCode, year);
  if (!entitlement) {
    console.warn(
      `[LeaveService] No leave entitlement found for employee ${employeeCode} in year ${year}. ` +
      `Leave approvals will be saved but annual tracking will not be updated. ` +
      `To enable annual tracking, configure leave entitlement in EmployeeLeaves table.`
    );
  }

  // Validate leave dates have valid values (0.5 or 1.0)
  for (const item of data.paidLeaveDates) {
    if (item.value !== 0.5 && item.value !== 1.0) {
      throw new Error(`Invalid paid leave value for date ${item.date}: ${item.value}. Must be 0.5 or 1.0`);
    }
  }
  for (const item of data.casualLeaveDates) {
    if (item.value !== 0.5 && item.value !== 1.0) {
      throw new Error(`Invalid casual leave value for date ${item.date}: ${item.value}. Must be 0.5 or 1.0`);
    }
  }

  // Validate date formats and that they belong to the specified month
  const allDates = [...data.paidLeaveDates, ...data.casualLeaveDates].map(item => item.date);
  if (allDates.length > 0 && !validateLeaveDates(allDates, month)) {
    throw new Error('All leave dates must be in YYYY-MM-DD format and belong to the specified month');
  }

  // Save monthly leave usage (idempotent - updates if exists, inserts if not)
  // This works even if EmployeeLeaves table is empty
  // Sums are calculated automatically in LeaveModel based on explicit values
  const { operation, record } = await LeaveModel.upsertMonthlyLeaveUsage(data);

  // Only update annual totals if entitlement exists
  if (entitlement) {
    try {
      // Recalculate annual totals from all monthly records
      const yearlyUsage = await LeaveModel.getYearlyLeaveUsage(employeeCode, year);
      const totalPaidUsed = yearlyUsage.reduce((sum, m) => sum + m.PaidLeaveDaysUsed, 0);
      const totalCasualUsed = yearlyUsage.reduce((sum, m) => sum + m.CasualLeaveDaysUsed, 0);

      // Update annual cumulative totals in EmployeeLeaves table
      await LeaveModel.updateAnnualLeaveUsage(
        employeeCode,
        year,
        totalPaidUsed,
        totalCasualUsed
      );
    } catch (err) {
      console.warn(`[LeaveService] Could not update annual leave usage: ${(err as Error).message}`);
      // Continue anyway - monthly usage is saved
    }
  }

  // Calculate leave balance (returns basic info even if entitlement doesn't exist)
  let leaveBalance: LeaveBalance;
  try {
    leaveBalance = await getLeaveBalance(employeeCode, year, month);
  } catch (err) {
    // If entitlement doesn't exist, return basic balance info
    leaveBalance = {
      employeeCode: employee.EmployeeCode,
      employeeName: employee.EmployeeName,
      year,
      allowedLeaves: 0,
      usedPaidLeaves: record.PaidLeaveDaysUsed,
      usedCasualLeaves: record.CasualLeaveDaysUsed,
      remainingLeaves: 0,
      monthlyUsage: record,
    };
  }

  return {
    success: true,
    operation,
    leaveBalance,
    monthlyUsage: record,
  };
}

/**
 * Get leave balance for an employee
 * Shows: annual entitlement, used leaves, remaining leaves
 * Optionally includes specific month's usage
 */
export async function getLeaveBalance(
  employeeCode: string,
  year: number,
  month?: string
): Promise<LeaveBalance> {
  // Get employee details
  const employee = await EmployeeModel.getByCode(employeeCode);
  if (!employee) {
    throw new Error(`Employee with code ${employeeCode} not found`);
  }

  // Get annual entitlement (optional - return basic info if not configured)
  const entitlement = await LeaveModel.getEmployeeLeaveEntitlement(employeeCode, year);
  
  // Get monthly usage if month is specified
  let monthlyUsage: MonthlyLeaveUsage | undefined;
  if (month) {
    try {
      const usage = await LeaveModel.getMonthlyLeaveUsage(employeeCode, month);
      if (usage) {
        monthlyUsage = usage;
      }
    } catch (err) {
      console.warn(`[LeaveService] Could not fetch monthly usage: ${(err as Error).message}`);
    }
  }

  // If entitlement exists, return full balance
  if (entitlement) {
    // Calculate remaining leaves
    // Formula: Allowed - (PaidUsed + CasualUsed)
    // Both paid and casual count as 1 day against the limit for simplicity
    const totalUsed = entitlement.UsedPaidLeaves + entitlement.UsedCasualLeaves;
    const remainingLeaves = Math.max(0, entitlement.AllowedLeaves - totalUsed);

    return {
      employeeCode: employee.EmployeeCode,
      employeeName: employee.EmployeeName,
      year,
      allowedLeaves: entitlement.AllowedLeaves,
      usedPaidLeaves: entitlement.UsedPaidLeaves,
      usedCasualLeaves: entitlement.UsedCasualLeaves,
      remainingLeaves,
      monthlyUsage,
    };
  }

  // If no entitlement, return basic balance with current month's usage
  const usedPaid = monthlyUsage?.PaidLeaveDaysUsed || 0;
  const usedCasual = monthlyUsage?.CasualLeaveDaysUsed || 0;

  return {
    employeeCode: employee.EmployeeCode,
    employeeName: employee.EmployeeName,
    year,
    allowedLeaves: 0, // Not configured
    usedPaidLeaves: usedPaid,
    usedCasualLeaves: usedCasual,
    remainingLeaves: 0, // Can't calculate without entitlement
    monthlyUsage,
  };
}

/**
 * Get monthly leave usage for an employee
 * Returns the persisted leave approvals for salary calculation
 */
export async function getMonthlyLeaveUsage(
  employeeCode: string,
  month: string
): Promise<MonthlyLeaveUsage | null> {
  return await LeaveModel.getMonthlyLeaveUsage(employeeCode, month);
}

/**
 * Parse leave dates from database (supports both JSON and legacy comma-separated format)
 * Returns array of { date, value } objects
 * 
 * For backward compatibility:
 * - If JSON format: parse and return as-is
 * - If comma-separated: convert to { date, value } with default values
 *   - PL default = 1.0
 *   - CL default = 0.5
 */
export function parseLeaveDatesWithValues(
  dateString: string | null,
  defaultValue: number = 1.0
): LeaveDateWithValue[] {
  return LeaveModel.parseLeaveDatesWithValues(dateString, defaultValue);
}

/**
 * Parse comma-separated date string to array (legacy function for backward compatibility)
 * @deprecated Use parseLeaveDatesWithValues instead
 */
export function parseLeaveDates(dateString: string | null): string[] {
  if (!dateString) return [];
  
  // If JSON format, extract dates only
  if (dateString.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(dateString) as LeaveDateWithValue[];
      if (Array.isArray(parsed)) {
        return parsed.map(item => item.date);
      }
    } catch (err) {
      // Fall through to legacy parsing
    }
  }
  
  // Legacy format: comma-separated dates
  return dateString.split(',').filter(d => d.trim().length > 0);
}

/**
 * Calculate Loss of Pay (LOP) days if leaves exceed entitlement
 * This is used in salary calculation
 * 
 * Logic:
 * - If (UsedPaid + UsedCasual) > Allowed, excess days are LOP
 * - LOP days result in salary deduction
 */
export function calculateLossOfPayDays(
  allowedLeaves: number,
  usedPaidLeaves: number,
  usedCasualLeaves: number
): number {
  const totalUsed = usedPaidLeaves + usedCasualLeaves;
  const exceeded = totalUsed - allowedLeaves;
  return Math.max(0, exceeded);
}

/**
 * Validate leave dates are in correct format and within the salary cycle
 * Salary cycle: 26th of previous month to 25th of current month
 * Example: For month "2025-11", valid dates are 2025-10-26 to 2025-11-25
 */
export function validateLeaveDates(dates: string[], month: string): boolean {
  // Get salary cycle range (26th to 25th)
  const { start, end } = getMonthRange(month);
  const cycleStart = createLocalDate(start);
  const cycleEnd = createLocalDate(end);

  for (const date of dates) {
    // Check format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn(`[LeaveService] Invalid date format: ${date}`);
      return false;
    }

    // Check date falls within salary cycle range
    const dateObj = createLocalDate(date);
    
    if (dateObj < cycleStart || dateObj > cycleEnd) {
      console.warn(
        `[LeaveService] Date ${date} is outside salary cycle ${start} to ${end} for month ${month}`
      );
      return false;
    }
  }

  return true;
}

