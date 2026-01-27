/**
 * Salary Controller
 * Handles salary and payroll-related business logic
 */

import { Request, Response } from 'express';
import * as payroll from '../services/payroll.js';
import { isValidMonthFormat, currentMonth, getMonthRange } from '../utils/date.js';
import { BatchSalaryRequest, SalaryCalculation } from '../types/index.js';

export class SalaryController {
  /**
   * Calculate salary for an employee
   */
  static async calculateSalary(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      // Validate userId is not NaN or invalid
      if (!userId || userId === 'NaN' || userId === 'undefined' || isNaN(Number(userId))) {
        res.status(400).json({
          success: false,
          error: 'Invalid employee ID',
          message: 'Employee ID must be a valid number',
        });
        return;
      }
      
      const month = (req.query.month as string) || currentMonth();
      const joinDate = (req.query.joinDate as string) || undefined;
      const exitDate = (req.query.exitDate as string) || undefined;
      
      // Extract paid leave and casual leave dates from query params
      // Convert string arrays to LeaveDateWithValue[] format
        // Fetch actual values from database if dates exist, otherwise use default values (PL = 1.0, CL = 0.5)
      const paidLeaveDatesRaw = Array.isArray(req.query.paidLeave) 
        ? req.query.paidLeave as string[]
        : req.query.paidLeave 
        ? [req.query.paidLeave as string]
        : [];
      
      const casualLeaveDatesRaw = Array.isArray(req.query.casualLeave)
        ? req.query.casualLeave as string[]
        : req.query.casualLeave
        ? [req.query.casualLeave as string]
        : [];

      // Fetch actual values from database for the provided dates
      let paidLeaveDates: Array<{ date: string; value: number }> = [];
      let casualLeaveDates: Array<{ date: string; value: number }> = [];
      
      try {
        const { LeaveModel } = await import('../models/LeaveModel.js');
        const monthlyLeaveUsage = await LeaveModel.getMonthlyLeaveUsage(userId.toString(), month);
        
        if (monthlyLeaveUsage) {
          // Parse leave dates from database
          const { parseLeaveDatesWithValues } = await import('../services/leaveService.js');
          const dbPaidLeaves = parseLeaveDatesWithValues(monthlyLeaveUsage.PaidLeaveDates, 1.0);
          const dbCasualLeaves = parseLeaveDatesWithValues(monthlyLeaveUsage.CasualLeaveDates, 0.5);
          
          // Create maps for quick lookup
          const dbPaidMap = new Map(dbPaidLeaves.map(item => [item.date, item.value]));
          const dbCasualMap = new Map(dbCasualLeaves.map(item => [item.date, item.value]));
          
          // Use values from database if date exists, otherwise use defaults
          paidLeaveDates = paidLeaveDatesRaw.map(date => ({ 
            date, 
            value: dbPaidMap.get(date) ?? 1.0 
          }));
          
          casualLeaveDates = casualLeaveDatesRaw.map(date => ({ 
            date, 
            value: dbCasualMap.get(date) ?? 0.5 
          }));
        } else {
          // No database record, use default values
          paidLeaveDates = paidLeaveDatesRaw.map(date => ({ date, value: 1.0 }));
          casualLeaveDates = casualLeaveDatesRaw.map(date => ({ date, value: 0.5 }));
        }
      } catch (err) {
        // If database fetch fails, use default values
        console.warn(`[SalaryController] Could not fetch leave values from database, using defaults: ${(err as Error).message}`);
        paidLeaveDates = paidLeaveDatesRaw.map(date => ({ date, value: 1.0 }));
        casualLeaveDates = casualLeaveDatesRaw.map(date => ({ date, value: 0.5 }));
      }

      // Log leave approvals for debugging
      if (paidLeaveDates.length > 0 || casualLeaveDates.length > 0) {
        console.log(`[SalaryController] Leave approvals for employee ${userId}:`, {
          paidLeave: paidLeaveDates,
          casualLeave: casualLeaveDates,
        });
      }

      if (!userId) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'User ID is required',
        });
        return;
      }

      if (!isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // Convert userId to EmployeeCode
      // userId can be either EmployeeId (number) or EmployeeCode (string)
      // The payroll service expects EmployeeCode, so we need to look it up if userId is numeric
      let employeeCode: string;
      const userIdNum = Number(userId);
      
      if (!isNaN(userIdNum) && userIdNum > 0) {
        // userId is a number (EmployeeId), need to get EmployeeCode
        const { EmployeeModel } = await import('../models/EmployeeModel.js');
        const employee = await EmployeeModel.getByCode(String(userId));
        if (!employee) {
          res.status(404).json({
            success: false,
            error: 'Employee not found',
            message: `Employee with ID ${userIdNum} not found`,
          });
          return;
        }
        employeeCode = employee.EmployeeCode;
      } else {
        // userId is already EmployeeCode (string)
        employeeCode = String(userId);
      }
      
      // Always pass arrays (even if empty) to prevent backend from fetching stale data from DB
      // Empty arrays explicitly mean "no leaves", undefined means "fetch from DB"
      // userid in devicelogs is VARCHAR (string), convert to string
      let salaryData;
      try {
        salaryData = await payroll.calculateSalary(
          employeeCode, 
          month,
          joinDate,
          exitDate,
          paidLeaveDates, // Pass array even if empty - backend will use this instead of DB
          casualLeaveDates // Pass array even if empty - backend will use this instead of DB
        );
      } catch (err) {
        const error = err as Error;
        // If it's a salary info error, return a more user-friendly message
        if (error.message.includes('Employee details not found') || error.message.includes('not found in EmployeeDetails')) {
          res.status(404).json({
            success: false,
            error: 'Employee details not found',
            message: `Employee ${employeeCode} does not have salary information configured. Please add employee details first.`,
          });
          return;
        }
        // Re-throw other errors
        throw err;
      }
      
      // Use the dailyBreakdown from salaryData.attendance (already calculated with correct weekoff payment status)
      // This ensures we store the EXACT same breakdown that was used for salary calculation
      let dailyBreakdown = salaryData.attendance?.dailyBreakdown;
      
      // Fallback: If dailyBreakdown is not available, fetch it separately
      // This should not happen, but provides a safety net
      if (!dailyBreakdown || dailyBreakdown.length === 0) {
        console.warn('[SalaryController] dailyBreakdown not found in salaryData.attendance, fetching separately...');
        try {
          // userid in devicelogs is VARCHAR (string), convert to string
          const fallbackBreakdown = await payroll.calculateMonthlyHours(
            String(userId),
            month,
            joinDate,
            exitDate,
            paidLeaveDates,
            casualLeaveDates
          );
          dailyBreakdown = fallbackBreakdown.dailyBreakdown;
        } catch (err) {
          console.warn('[SalaryController] Could not fetch attendance breakdown for storage:', err);
          dailyBreakdown = []; // Fallback to empty array
        }
      }
      
      // Fetch regularization data if available
      let regularizedDates: Array<{ date: string; value: number; originalStatus: string }> = [];
      try {
        const { AttendanceRegularizationModel } = await import('../models/AttendanceRegularizationModel.js');
        const { start, end } = getMonthRange(month);
        const effectiveStart = joinDate && joinDate > start ? joinDate : start;
        const effectiveEnd = exitDate && exitDate < end ? exitDate : end;
        
        const regularizations = await AttendanceRegularizationModel.getRegularizationsByDateRange(
          userId.toString(),
          effectiveStart,
          effectiveEnd
        );
        
        // Convert regularizations to format needed for PDF
        regularizedDates = regularizations.map(reg => {
          // Format date as YYYY-MM-DD string
          const dateStr = reg.RegularizationDate instanceof Date 
            ? reg.RegularizationDate.toISOString().split('T')[0]
            : new Date(reg.RegularizationDate).toISOString().split('T')[0];
          
          return {
            date: dateStr,
            value: reg.RegularizedStatus === 'full-day' ? 1.0 : 0.5,
            originalStatus: reg.OriginalStatus,
          };
        });
      } catch (err) {
        console.warn('[SalaryController] Could not fetch regularization data:', err);
      }
      
      // Save calculated salary to MonthlySalary table (single source of truth)
      try {
        const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
        const { SalaryHoldModel } = await import('../models/SalaryHoldModel.js');
        
        // Check if salary is held
        const hold = await SalaryHoldModel.getHold(userId.toString(), month);
        const isHeld = !!hold && !hold.IsReleased;
        
        // Calculate paid days (full days + half days + paid leaves)
        const paidDays = (salaryData.attendance?.fullDays || 0) + 
                        ((salaryData.attendance?.halfDays || 0) * 0.5) +
                        (paidLeaveDates.reduce((sum, item) => sum + item.value, 0)) +
                        (casualLeaveDates.reduce((sum, item) => sum + item.value, 0));
        
        // Calculate total additions (overtime + incentive + adjustment additions)
        const totalAdditions = (salaryData.breakdown?.overtimeAmount || 0) +
                              (salaryData.breakdown?.incentiveAmount || 0) +
                              (salaryData.breakdown?.adjustmentAdditions || 0);
        
        // Store COMPLETE breakdown as JSON for PDF generation
        // This includes all data needed to generate the exact same PDF as admin portal
        const completeBreakdown = {
          // Salary breakdown
          breakdown: salaryData.breakdown || {},
          // Attendance data
          attendance: {
            fullDays: salaryData.attendance?.fullDays || 0,
            halfDays: salaryData.attendance?.halfDays || 0,
            absentDays: salaryData.attendance?.absentDays || 0,
            lateDays: salaryData.attendance?.lateDays || 0,
            lateBy30MinutesDays: salaryData.attendance?.lateBy30MinutesDays || 0,
            earlyExits: salaryData.attendance?.earlyExits || 0,
            totalWorkedHours: salaryData.attendance?.totalWorkedHours || 0,
            overtimeHours: salaryData.attendance?.overtimeHours || 0,
            sundaysInMonth: salaryData.attendance?.sundaysInMonth || 0,
            totalPayableDays: salaryData.attendance?.totalPayableDays || 0,
            totalDays: salaryData.attendance?.totalDays || 0,
          },
          // Daily breakdown (for PDF attendance table)
          // Use the EXACT same breakdown that was used for salary calculation (with correct weekoff payment status)
          dailyBreakdown: dailyBreakdown || [],
          // Leave dates with values (for PDF calculation)
          paidLeaveDates: paidLeaveDates || [],
          casualLeaveDates: casualLeaveDates || [],
          // Regularization dates (for PDF calculation)
          regularizedDates: regularizedDates || [],
          // Leave info
          leaveInfo: salaryData.leaveInfo || null,
        };
        
        const breakdownJson = JSON.stringify(completeBreakdown);
        
        // Check if salary already exists and is FINALIZED
        // If it's FINALIZED, preserve the status; otherwise set to DRAFT
        const existingSalary = await MonthlySalaryModel.getSalary(
          userId.toString(),
          month,
          false // Don't filter by finalizedOnly - we need to check current status
        );
        const preserveStatus = existingSalary?.Status === 1 ? 1 : 0; // Preserve FINALIZED, otherwise DRAFT
        
        await MonthlySalaryModel.upsertSalary({
          employeeCode: userId.toString(),
          month: month,
          grossSalary: salaryData.grossSalary || salaryData.baseSalary || 0,
          netSalary: salaryData.netSalary || 0,
          baseSalary: salaryData.baseSalary || 0,
          paidDays: paidDays,
          absentDays: salaryData.attendance?.absentDays || 0,
          leaveDays: paidLeaveDates.length + casualLeaveDates.length,
          totalDeductions: salaryData.breakdown?.totalDeductions || 0,
          totalAdditions: totalAdditions,
          isHeld: isHeld,
          holdReason: hold?.Reason || null,
          calculatedBy: (req as any).user?.username || 'ADMIN', // Get from auth if available
          perDayRate: salaryData.breakdown?.perDayRate ?? null,
          totalWorkedHours: salaryData.attendance?.totalWorkedHours ?? null,
          overtimeHours: salaryData.attendance?.overtimeHours ?? null,
          overtimeAmount: salaryData.breakdown?.overtimeAmount ?? null,
          tdsDeduction: salaryData.breakdown?.tdsDeduction ?? undefined,
          professionalTax: salaryData.breakdown?.professionalTax ?? undefined,
          incentiveAmount: salaryData.breakdown?.incentiveAmount ?? undefined,
          breakdownJson: breakdownJson,
          status: preserveStatus, // Preserve FINALIZED status if already finalized, otherwise DRAFT
        });
        
        console.log(`[SalaryController] ✓ Salary saved to MonthlySalary for employee ${userId}, month ${month}`);
      } catch (saveError) {
        // Log error but don't fail the request - calculation succeeded
        console.error('[SalaryController] Warning: Failed to save salary to MonthlySalary:', saveError);
        // Continue to return calculated salary even if save fails
      }
      
      res.json({
        success: true,
        data: salaryData,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error calculating salary:', error);
      
      // Check if it's an employee not found error
      if (error.message.includes('not found in Excel')) {
        res.status(404).json({
          error: 'Employee Not Found',
          message: error.message,
          details: 'This employee does not exist in the Excel salary register',
        });
        return;
      }
      
      res.status(500).json({
        error: 'Calculation Error',
        message: 'Failed to calculate salary',
        details: error.message,
      });
    }
  }

  /**
   * Get monthly hours breakdown for an employee
   */
  static async getMonthlyHours(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const month = (req.query.month as string) || currentMonth();

      if (!isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // userid in devicelogs is VARCHAR (string), convert to string
      const hoursData = await payroll.calculateMonthlyHours(String(userId), month);

      res.json({
        success: true,
        data: hoursData,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error calculating hours:', error);
      res.status(500).json({
        error: 'Calculation Error',
        message: 'Failed to calculate monthly hours',
        details: error.message,
      });
    }
  }

  /**
   * Get detailed daily breakdown
   */
  static async getDailyBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const { userId, month } = req.params;

      if (!isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // userid in devicelogs is VARCHAR (string), convert to string
      const hoursData = await payroll.calculateMonthlyHours(String(userId), month);

      res.json({
        success: true,
        data: {
          userId: parseInt(userId, 10),
          month,
          summary: {
            totalWorkedHours: hoursData.totalWorkedHours,
            fullDays: hoursData.fullDays,
            halfDays: hoursData.halfDays,
            absentDays: hoursData.absentDays,
            lateDays: hoursData.lateDays,
            earlyExits: hoursData.earlyExits,
          },
          dailyBreakdown: hoursData.dailyBreakdown,
        }
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error fetching breakdown:', error);
      res.status(500).json({
        error: 'Calculation Error',
        message: 'Failed to fetch daily breakdown',
        details: error.message,
      });
    }
  }

  /**
   * Calculate salary for multiple employees (batch)
   */
  static async batchCalculateSalary(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCodes, month } = req.body as BatchSalaryRequest;

      if (!employeeCodes || !Array.isArray(employeeCodes) || employeeCodes.length === 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'employeeCodes must be a non-empty array',
        });
        return;
      }

      const targetMonth = month || currentMonth();

      if (!isValidMonthFormat(targetMonth)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // Calculate salary for each employee
      const results = [];
      const errors = [];

      for (const code of employeeCodes) {
        try {
          // userid in devicelogs is VARCHAR (string), use as string
          const userId = String(code);
          const salaryData = await payroll.calculateSalary(userId, targetMonth);
          results.push(salaryData);
        } catch (err) {
          const error = err as Error;
          errors.push({
            employeeCode: code,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        month: targetMonth,
        processed: results.length,
        failed: errors.length,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error in batch salary calculation:', error);
      res.status(500).json({
        error: 'Calculation Error',
        message: 'Failed to process batch salary calculation',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/salary/summary
   * Get salary summary for all employees in EmployeeDetails table
   * Processes in chunks to prevent server overload
   * Query params: month (YYYY-MM), chunkSize (default: 10)
   */
  static async getSalarySummary(req: Request, res: Response): Promise<void> {
    try {
      const { month, chunkSize = '10' } = req.query;
      const targetMonth = (month as string) || currentMonth();
      const chunkSizeNum = parseInt(chunkSize as string, 10) || 10;

      if (!isValidMonthFormat(targetMonth)) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // Get all employees from EmployeeDetails table only
      // Include active employees + employees who exited in the selected month
      const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
      const allEmployees = await EmployeeDetailsModel.getAllActive(targetMonth);
      
      if (allEmployees.length === 0) {
        res.json({
          success: true,
          month: targetMonth,
          totalEmployees: 0,
          processed: 0,
          data: [],
          totalNetSalary: 0,
        });
        return;
      }

      const employeeCodes = allEmployees.map(emp => emp.EmployeeCode);
      
      // Process in chunks to prevent server overload
      const results: SalaryCalculation[] = [];
      const errors: Array<{ employeeCode: string; error: string }> = [];
      
      console.log(`[SalaryController] Processing ${employeeCodes.length} employees in chunks of ${chunkSizeNum}`);

      // Create a map of employee details for quick lookup
      const employeeDetailsMap = new Map(allEmployees.map(emp => [emp.EmployeeCode, emp]));

      // Process employees in chunks
      for (let i = 0; i < employeeCodes.length; i += chunkSizeNum) {
        const chunk = employeeCodes.slice(i, i + chunkSizeNum);
        console.log(`[SalaryController] Processing chunk ${Math.floor(i / chunkSizeNum) + 1}/${Math.ceil(employeeCodes.length / chunkSizeNum)} (${chunk.length} employees)`);
        
        // Process chunk in parallel with Promise.all
        const chunkPromises = chunk.map(async (code) => {
          try {
            // userid in devicelogs is VARCHAR (string), use as string
            const userId = String(code);
            
            // Get employee details for joining/exit dates
            const empDetails = employeeDetailsMap.get(code);
            let joinDate: string | undefined = undefined;
            let exitDate: string | undefined = undefined;
            
            // Only use joining date if selected month matches joining month
            if (empDetails?.JoiningDate) {
              const joiningDateStr = empDetails.JoiningDate.split('T')[0]; // "YYYY-MM-DD"
              const joiningMonth = joiningDateStr.substring(0, 7); // "YYYY-MM"
              
              if (targetMonth === joiningMonth) {
                joinDate = joiningDateStr;
                console.log(`[SalaryController] Using joining date for ${code}: ${joinDate} (matches month ${targetMonth})`);
              }
            }
            
            // Use exit date if exists
            if (empDetails?.ExitDate) {
              exitDate = empDetails.ExitDate.split('T')[0]; // "YYYY-MM-DD"
              console.log(`[SalaryController] Using exit date for ${code}: ${exitDate}`);
            }
            
            // Get approved leave data from database
            const { LeaveModel } = await import('../models/LeaveModel.js');
            const leaveApprovals = await LeaveModel.getMonthlyLeaveUsage(code, targetMonth);
            
            // Helper function to parse leave dates and convert to LeaveDateWithValue[] format
            // Handles both JSON format [{"date":"2025-11-29","value":0.5}] and legacy string format
            const parseLeaveDatesWithValues = (
              data: string | string[] | null | undefined,
              defaultValue: number
            ): Array<{ date: string; value: number }> => {
              if (!data) return [];
              
              try {
                let parsed: any[] = [];
                
                // If already an array
                if (Array.isArray(data)) {
                  parsed = data;
                } else if (typeof data === 'string') {
                  const trimmed = data.trim();
                  if (!trimmed) return [];
                  
                  // Try to parse as JSON first (if it starts with '[')
                  if (trimmed.startsWith('[')) {
                    try {
                      const jsonParsed = JSON.parse(trimmed);
                      parsed = Array.isArray(jsonParsed) ? jsonParsed : [];
                    } catch (jsonErr) {
                      // Not JSON, treat as comma-separated string
                      parsed = trimmed.includes(',') 
                        ? trimmed.split(',').map(d => d.trim()).filter(d => d.length > 0)
                        : [trimmed];
                    }
                  } else {
                    // Handle comma-separated dates: "2025-10-30,2025-11-17,2025-11-03"
                    if (trimmed.includes(',')) {
                      parsed = trimmed.split(',').map(d => d.trim()).filter(d => d.length > 0);
                    } else if (trimmed.includes('.')) {
                      // Handle dot-separated dates: "2025-11-22.2025-11-12"
                      parsed = trimmed.split('.').map(d => d.trim()).filter(d => d.length > 0);
                    } else {
                      // Single date string: "2025-11-06"
                      parsed = [trimmed];
                    }
                  }
                }
                
                // Convert to LeaveDateWithValue[] format
                return parsed.map(item => {
                  // If it's already an object with date and value
                  if (typeof item === 'object' && item !== null && 'date' in item) {
                    return {
                      date: String(item.date),
                      value: (item.value === 0.5 || item.value === 1.0) ? item.value : defaultValue
                    };
                  }
                  // If it's a string, use default value
                  return {
                    date: String(item),
                    value: defaultValue
                  };
                }).filter(item => item.date && typeof item.date === 'string');
              } catch (err) {
                console.warn(`[SalaryController] Error parsing leave dates for ${code}:`, err);
                return [];
              }
            };
            
            // Extract paid leave and casual leave dates from database
            // Convert to LeaveDateWithValue[] format with default values
            let paidLeaveDates = parseLeaveDatesWithValues(leaveApprovals?.PaidLeaveDates, 1.0);
            let casualLeaveDates = parseLeaveDatesWithValues(leaveApprovals?.CasualLeaveDates, 0.5);
            
            // IMPORTANT: Filter leave dates to only include dates from the target month
            // This prevents October leave dates from affecting November salary calculation
            const targetMonthPrefix = targetMonth + '-'; // e.g., "2025-11-"
            paidLeaveDates = paidLeaveDates.filter(item => item.date.startsWith(targetMonthPrefix));
            casualLeaveDates = casualLeaveDates.filter(item => item.date.startsWith(targetMonthPrefix));
            
            if (paidLeaveDates.length > 0 || casualLeaveDates.length > 0) {
              console.log(`[SalaryController] Leave dates for ${code} in ${targetMonth}:`, {
                paidLeave: paidLeaveDates,
                casualLeave: casualLeaveDates,
              });
            }
            
            // CRITICAL: Check if salary is held for this employee and month
            // If held, skip salary calculation and exclude from summary
            const { SalaryHoldModel } = await import('../models/SalaryHoldModel.js');
            const salaryHold = await SalaryHoldModel.isSalaryHeld(code, targetMonth);
            
            if (salaryHold && !salaryHold.IsReleased) {
              console.log(`[SalaryController] ⏸️ Skipping employee ${code} - salary is HELD (${salaryHold.HoldType}) for ${targetMonth}`);
              return { success: false, employeeCode: code, error: 'Salary is held', skipped: true };
            }
            
            // AUTOMATIC HOLD LOGIC: Check if employee is absent on 1-5 of next month
            // If absent, create AUTO hold for next month (if not already present)
            try {
              const { checkAndCreateAutoHold } = await import('../services/salaryHoldService.js');
              await checkAndCreateAutoHold(code, targetMonth);
            } catch (autoHoldError: any) {
              // Log but don't fail salary calculation if auto-hold check fails
              console.warn(`[SalaryController] Auto-hold check failed for ${code}:`, autoHoldError.message);
            }
            
            // Calculate salary with joining/exit dates AND leave approvals
            // IMPORTANT: Pass undefined for leave dates to let calculateSalary fetch from DB itself
            // This ensures we use the EXACT same logic as the individual salary page endpoint
            // The individual salary page also lets the backend fetch from DB when dates aren't provided
            // This guarantees consistent results between individual page and summary
            const salaryData = await payroll.calculateSalary(
              userId, 
              targetMonth, 
              joinDate, 
              exitDate,
              undefined, // Let calculateSalary fetch from DB (same as individual page)
              undefined  // Let calculateSalary fetch from DB (same as individual page)
            );
            return { success: true, data: salaryData };
          } catch (err) {
            const error = err as Error;
            console.error(`[SalaryController] Error calculating salary for ${code}:`, error.message);
            return { success: false, employeeCode: code, error: error.message };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        
        // Separate successes and errors
        // Skip employees with held salaries (they're not errors, just excluded)
        chunkResults.forEach(result => {
          if (result.success && result.data) {
            results.push(result.data);
          } else if (!result.success) {
            // Only add to errors if not skipped due to salary hold
            if (!(result as any).skipped) {
              errors.push({
                employeeCode: result.employeeCode || 'unknown',
                error: result.error || 'Unknown error',
              });
            }
          }
        });

        // Small delay between chunks to prevent overwhelming the server
        if (i + chunkSizeNum < employeeCodes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Calculate total net salary
      const totalNetSalary = results.reduce((sum, salary) => sum + salary.netSalary, 0);

      console.log(`[SalaryController] ✅ Processed ${results.length}/${employeeCodes.length} employees successfully`);

      res.json({
        success: true,
        month: targetMonth,
        totalEmployees: employeeCodes.length,
        processed: results.length,
        failed: errors.length,
        data: results,
        totalNetSalary: parseFloat(totalNetSalary.toFixed(2)),
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error in salary summary:', error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Failed to generate salary summary',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/salary/:userId/recent-attendance
   * Get last 10 working days of attendance data from today backwards
   * Path params: userId (employee user ID)
   * Query params: none (always uses current date)
   */
  static async getRecentAttendance(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'User ID is required',
        });
        return;
      }

      // userid in devicelogs is VARCHAR (string), use as string
      const employeeId = String(userId);

      // Get current date in local timezone (YYYY-MM-DD)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      console.log(`[SalaryController] 📅 Recent attendance request for employee ${employeeId} - Today is ${todayStr}`);
      
      // Calculate date range: last 30 days ending yesterday (exclude today)
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() - 1); // Yesterday
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30); // Go back 30 days
      
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`[SalaryController] Querying attendance data from ${startDateStr} to ${endDateStr}`);

      // Get current and previous month data (salary cycles)
      const currentMonth = todayStr.substring(0, 7); // YYYY-MM
      const prevMonthDate = new Date(today);
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const { calculateMonthlyHours } = await import('../services/payroll.js');
      
      // Fetch both months
      const currentMonthData = await calculateMonthlyHours(employeeId, currentMonth);
      const prevMonthData = await calculateMonthlyHours(employeeId, prevMonth);
      
      // Combine and filter to our date range
      let allDailyData = [
        ...prevMonthData.dailyBreakdown,
        ...currentMonthData.dailyBreakdown
      ].filter(day => day.date >= startDateStr && day.date <= endDateStr);
      
      // Remove duplicates (keep the one from current month if both exist)
      const uniqueData = new Map<string, any>();
      allDailyData.forEach(day => {
        if (!uniqueData.has(day.date) || day.date >= currentMonthData.dailyBreakdown[0]?.date) {
          uniqueData.set(day.date, day);
        }
      });
      
      let filteredData = Array.from(uniqueData.values());
      
      // Check if endDateStr (yesterday) is missing from our data
      // This happens when yesterday is in the next month's salary cycle
      // e.g., Dec 26 is in Jan 2026 cycle, but data is in DeviceLogs_12_2025
      const existingDates = new Set(filteredData.map(d => d.date));
      
      if (!existingDates.has(endDateStr)) {
        // Query raw logs for the missing end date
        const { AttendanceModel } = await import('../models/AttendanceModel.js');
        try {
          // userid in devicelogs is VARCHAR (string), already a string
          const dayLogs = await AttendanceModel.getDailyByEmployeeAndDate(employeeId, endDateStr);
          if (dayLogs.length > 0) {
            // Process this day's logs into daily breakdown format
            // Use calculateDayHours from payroll service (will use default shift if null)
            const { calculateDayHours } = await import('../services/payroll.js');
            
            // Use null for shift timing - calculateDayHours will use default (10 AM - 7 PM)
            const dayHours = calculateDayHours(dayLogs, null);
            
            filteredData.push({
              date: endDateStr,
              status: dayHours.status,
              hours: dayHours.totalHours,
              firstEntry: dayHours.firstEntry,
              lastExit: dayHours.lastExit
            });
            
            console.log(`[SalaryController] ✅ Added missing date ${endDateStr} with status: ${dayHours.status}`);
          }
        } catch (err) {
          console.log(`[SalaryController] Could not fetch data for ${endDateStr}: ${err}`);
        }
      }
      
      // Sort by date descending (newest first) for the rest of the logic
      filteredData.sort((a, b) => b.date.localeCompare(a.date));

      console.log(`[SalaryController] Total daily data entries: ${filteredData.length}`);
      
      // Show the most recent 5 dates for debugging
      const recentDates = filteredData.slice(0, 5).map(d => `${d.date} (${d.status})`);
      console.log(`[SalaryController] Most recent dates in data: ${recentDates.join(', ')}`);

      // Get last 10 working days starting from YESTERDAY (exclude today since attendance may be incomplete)
      const last10WorkingDays: any[] = [];
      
      for (const dayData of filteredData) {
        // Only include dates BEFORE today (not including today)
        // If today is Dec 27, show data up to Dec 26
        if (dayData.date >= todayStr) {
          console.log(`[SalaryController] ⏭️  Skipping ${dayData.date} (today or future)`);
          continue;
        }
        
        // Include only non-weekoff days
        if (dayData.status !== 'weekoff') {
          last10WorkingDays.push({
            date: dayData.date,
            data: dayData
          });
        }
        
        // Stop once we have 10 working days
        if (last10WorkingDays.length >= 10) break;
      }

      console.log(`[SalaryController] ✅ Found ${last10WorkingDays.length} working days`);
      
      if (last10WorkingDays.length > 0) {
        console.log(`[SalaryController] 📊 Working days range: ${last10WorkingDays[last10WorkingDays.length - 1].date} to ${last10WorkingDays[0].date}`);
      }

      // Now find all weekoffs within the date range of these 10 working days
      if (last10WorkingDays.length > 0) {
        const oldestDate = last10WorkingDays[last10WorkingDays.length - 1].date;
        const newestDate = last10WorkingDays[0].date;
        
        const weekoffsInRange = filteredData.filter(day => 
          day.status === 'weekoff' && 
          day.date >= oldestDate && 
          day.date <= newestDate
        ).map(day => ({
          date: day.date,
          data: day
        }));

        console.log(`[SalaryController] Found ${weekoffsInRange.length} weekoffs in range`);

        // Combine and sort
        const allDays = [...last10WorkingDays, ...weekoffsInRange];
        allDays.sort((a, b) => a.date.localeCompare(b.date));
        
        console.log(`[SalaryController] 📅 Final date range: ${allDays[0].date} to ${allDays[allDays.length - 1].date} (${allDays.length} total days)`);


        res.json({
          success: true,
          data: {
            userId: employeeId,
            generatedDate: todayStr,
            recentAttendance: allDays
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            userId: employeeId,
            generatedDate: todayStr,
            recentAttendance: []
          }
        });
      }
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error fetching recent attendance:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to fetch recent attendance',
        details: error.message,
      });
    }
  }

  /**
   * Finalize salary for an employee and month
   * Changes Status from DRAFT (0) to FINALIZED (1)
   * POST /api/salary/:userId/finalize
   */
  static async finalizeSalary(req: Request, res: Response): Promise<void> {
    try {
      const { month } = req.body;
      const { userId } = req.params; // Employee user ID

      if (!month || !isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Valid month (YYYY-MM) is required in request body',
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Employee user ID is required in path',
        });
        return;
      }

      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const calculatedBy = (req as any).user?.username || 'ADMIN';

      // Finalize salary (only if Status = 0)
      const finalizedSalary = await MonthlySalaryModel.finalizeSalary(
        userId.toString(),
        month,
        calculatedBy
      );

      if (!finalizedSalary) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Salary not found or already finalized',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Salary finalized successfully',
        data: {
          employeeCode: finalizedSalary.EmployeeCode,
          month: finalizedSalary.Month,
          status: finalizedSalary.Status,
          finalizedAt: finalizedSalary.CalculatedAt,
          finalizedBy: finalizedSalary.CalculatedBy,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error finalizing salary:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to finalize salary',
        details: error.message,
      });
    }
  }

  /**
   * Get salary finalized status for an employee and month
   * GET /api/salary/:userId/status?month=YYYY-MM
   */
  static async getSalaryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const month = (req.query.month as string) || currentMonth();

      if (!userId) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Employee user ID is required in path',
        });
        return;
      }

      if (!isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Valid month (YYYY-MM) is required',
        });
        return;
      }

      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const salaryRecord = await MonthlySalaryModel.getSalary(
        userId.toString(),
        month,
        false // Don't filter - we need to check current status
      );

      res.json({
        success: true,
        data: {
          employeeCode: userId.toString(),
          month: month,
          status: salaryRecord?.Status ?? 0, // 0 = DRAFT, 1 = FINALIZED
          isFinalized: salaryRecord?.Status === 1,
          exists: !!salaryRecord,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error getting salary status:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to get salary status',
        details: error.message,
      });
    }
  }

  /**
   * Finalize all salaries for a specific month
   * Changes Status from DRAFT (0) to FINALIZED (1) for all employees in the month
   * POST /api/salary/finalize-all
   */
  static async finalizeAllSalaries(req: Request, res: Response): Promise<void> {
    try {
      const { month } = req.body;

      if (!month || !isValidMonthFormat(month)) {
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Valid month (YYYY-MM) is required in request body',
        });
        return;
      }

      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const calculatedBy = (req as any).user?.username || 'ADMIN';

      // Finalize all salaries for the month (only if Status = 0)
      const result = await MonthlySalaryModel.finalizeAllSalariesForMonth(
        month,
        calculatedBy
      );

      res.json({
        success: true,
        message: `Successfully finalized ${result.updated} salary record(s) for ${month}`,
        data: {
          month: month,
          updated: result.updated,
          finalizedAt: new Date().toISOString(),
          finalizedBy: calculatedBy,
        },
      });
    } catch (err) {
      const error = err as Error;
      console.error('[SalaryController] Error finalizing all salaries:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to finalize all salaries',
        details: error.message,
      });
    }
  }
}

export default SalaryController;

