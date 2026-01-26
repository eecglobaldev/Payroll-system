/**
 * Employee Self-Service Controller
 * Handles employee-only endpoints (read-only access to own data)
 * All endpoints require JWT authentication
 */

import { Request, Response } from 'express';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';

export class EmployeeSelfServiceController {
  /**
   * GET /api/employee/me
   * Get current employee's profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      
      if (!employeeCode) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Get employee basic info
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Get employee details
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);
      
      console.log(`[EmployeeSelfService] Profile data for ${employeeCode}:`, {
        phoneFromDB: employeeDetails?.PhoneNumber,
        department: employeeDetails?.Department,
      });
      
      // Combine data into profile format
      const profile = {
        employeeCode: employee.EmployeeCode,
        employeeId: employee.EmployeeId,
        name: employee.EmployeeName,
        email: null, // Email not in Employee model
        phone: employeeDetails?.PhoneNumber || null,
        department: employeeDetails?.Department || null,
        designation: employeeDetails?.Designation || null,
        branchLocation: employeeDetails?.BranchLocation || null,
        joiningDate: employeeDetails?.JoiningDate || null,
        shift: employeeDetails?.Shift || null,
      };
      
      console.log(`[EmployeeSelfService] Final profile response:`, {
        phone: profile.phone,
      });

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error getting profile:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * PATCH /api/employee/me
   * Update current employee's profile (limited fields)
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      
      if (!employeeCode) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Only allow updating certain fields
      const allowedFields = ['phoneNumber', 'email'];
      const updates: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: 'No valid fields to update',
        });
        return;
      }

      // Update employee details
      const updated = await EmployeeDetailsModel.update(employeeCode, updates);
      
      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Employee details not found',
        });
        return;
      }

      res.json({
        success: true,
        data: updated,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error updating profile:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/employee/salary?month=YYYY-MM
   * Get current employee's salary for a specific month (READ-ONLY from MonthlySalary)
   * If month not specified or not found, returns latest available salary
   * 
   * SECURITY: Employee can only access their own salary
   * NO CALCULATION: Only reads from stored MonthlySalary table
   */
  static async getSalary(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      const monthParam = req.query.month as string;
      
      console.log('[EmployeeSelfService] getSalary called:', {
        employeeCode,
        userId: req.userId,
        monthParam,
        hasEmployeeCode: !!employeeCode,
        hasUserId: !!req.userId,
      });
      
      if (!employeeCode || !req.userId) {
        console.error('[EmployeeSelfService] Missing employeeCode or userId:', {
          employeeCode,
          userId: req.userId,
        });
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Read salary from MonthlySalary table (NO CALCULATION)
      console.log('[EmployeeSelfService] Importing MonthlySalaryModel...');
      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const { EmployeeDetailsModel } = await import('../models/EmployeeDetailsModel.js');
      console.log('[EmployeeSelfService] Models imported successfully');
      
      let salaryRecord: any = null;
      
      // IMPORTANT: Only fetch FINALIZED salaries (Status = 1)
      // Employees must NOT see DRAFT salaries
      // If month is specified, try to get that month's salary (FINALIZED only)
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        console.log('[EmployeeSelfService] Fetching salary for month:', monthParam);
        salaryRecord = await MonthlySalaryModel.getSalary(employeeCode, monthParam, true);
        console.log('[EmployeeSelfService] Salary record for month:', salaryRecord ? 'Found' : 'Not found');
      }
      
      // If not found and month was specified, or if no month specified, get latest salary (FINALIZED only)
      if (!salaryRecord) {
        console.log('[EmployeeSelfService] Fetching latest salary...');
        salaryRecord = await MonthlySalaryModel.getLatestSalary(employeeCode, true);
        console.log('[EmployeeSelfService] Latest salary record:', salaryRecord ? 'Found' : 'Not found');
      }

      // Get employee details for base salary and per day rate
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);
      const baseSalary = employeeDetails?.BasicSalary || 0;
      
      // Calculate per day rate from base salary (assuming 30 days in a month)
      // This is a standard calculation: baseSalary / 30
      const perDayRate = baseSalary > 0 ? baseSalary / 30 : 0;

      // If no salary record found at all, return NOT_FINALIZED status
      // This means either salary doesn't exist or is still in DRAFT status
      if (!salaryRecord) {
        res.json({
          success: true,
          status: 'NOT_FINALIZED',
          message: 'Salary not finalized yet. Please contact HR.',
          // Still return base salary from EmployeeDetails
          baseSalary: baseSalary,
          perDayRate: perDayRate,
        });
        return;
      }

      // Return stored salary data with base salary and per day rate from EmployeeDetails
      res.json({
        success: true,
        data: {
          month: salaryRecord.Month,
          grossSalary: salaryRecord.GrossSalary || 0,
          netSalary: salaryRecord.NetSalary || 0,
          baseSalary: baseSalary, // From EmployeeDetails, not MonthlySalary
          perDayRate: perDayRate, // Calculated from EmployeeDetails baseSalary
          paidDays: salaryRecord.PaidDays || 0,
          absentDays: salaryRecord.AbsentDays || 0,
          leaveDays: salaryRecord.LeaveDays || 0,
          totalDeductions: salaryRecord.TotalDeductions || 0,
          totalAdditions: salaryRecord.TotalAdditions || 0,
          totalWorkedHours: salaryRecord.TotalWorkedHours || 0,
          overtimeHours: salaryRecord.OvertimeHours || 0,
          overtimeAmount: salaryRecord.OvertimeAmount || 0,
          tdsDeduction: salaryRecord.TdsDeduction || null,
          professionalTax: salaryRecord.ProfessionalTax || null,
          incentiveAmount: salaryRecord.IncentiveAmount || null,
          isHeld: salaryRecord.IsHeld,
          holdReason: salaryRecord.HoldReason,
          calculatedAt: salaryRecord.CalculatedAt,
          paymentDate: null, // Payment date not tracked yet
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error getting salary:', err);
      console.error('[EmployeeSelfService] Error stack:', err.stack);
      console.error('[EmployeeSelfService] EmployeeCode:', req.employeeCode);
      console.error('[EmployeeSelfService] UserId:', req.userId);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/employee/salary/history
   * Get current employee's salary history (READ-ONLY from MonthlySalary)
   * 
   * SECURITY: Employee can only access their own salary history
   * NO CALCULATION: Only reads from stored MonthlySalary table
   */
  static async getSalaryHistory(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      
      if (!employeeCode || !req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Read salary history from MonthlySalary table (NO CALCULATION)
      // IMPORTANT: Only fetch FINALIZED salaries (Status = 1)
      // Employees must NOT see DRAFT salaries
      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const historyRecords = await MonthlySalaryModel.getSalaryHistory(employeeCode, 12, true);

      // Map to response format
      const history = historyRecords.map(record => ({
        month: record.Month,
        grossSalary: record.GrossSalary || 0,
        netSalary: record.NetSalary || 0,
        baseSalary: record.BaseSalary || 0,
        perDayRate: record.PerDayRate || 0,
        paidDays: record.PaidDays || 0,
        absentDays: record.AbsentDays || 0,
        leaveDays: record.LeaveDays || 0,
        totalDeductions: record.TotalDeductions || 0,
        totalAdditions: record.TotalAdditions || 0,
        isHeld: record.IsHeld,
        holdReason: record.HoldReason,
        calculatedAt: record.CalculatedAt,
        paymentDate: null, // Payment date not tracked yet
      }));

      res.json({
        success: true,
        data: history.reverse(), // Oldest first
      });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error getting salary history:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/employee/attendance?month=YYYY-MM
   * Get current employee's attendance for a specific month
   */
  static async getAttendance(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      const month = req.query.month as string || new Date().toISOString().slice(0, 7);
      
      if (!employeeCode || !req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Get employee to get userId
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Get employee details for join/exit dates
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);

      // Use payroll service's calculateMonthlyHours to get detailed attendance
      // This provides the same detailed breakdown as the admin endpoint
      const employeeNo = parseInt(employee.EmployeeCode, 10);
      if (isNaN(employeeNo)) {
        res.status(400).json({
          success: false,
          error: 'Invalid employee code format',
        });
        return;
      }

      const payroll = await import('../services/payroll.js');
      const attendance = await payroll.calculateMonthlyHours(
        employeeNo,
        month,
        employeeDetails?.JoiningDate || undefined,
        employeeDetails?.ExitDate || undefined,
        [], // paidLeave - empty array means no leaves
        [] // casualLeave - empty array means no leaves
      );

      // Fetch leave data directly from MonthlyLeaveUsage table
      let paidLeaveDates: Array<{ date: string; value: number }> = [];
      let casualLeaveDates: Array<{ date: string; value: number }> = [];
      
      try {
        const { LeaveModel } = await import('../models/LeaveModel.js');
        const monthlyLeaveUsage = await LeaveModel.getMonthlyLeaveUsage(employeeCode, month);
        
        if (monthlyLeaveUsage) {
          // Parse paid leave dates with values
          paidLeaveDates = LeaveModel.parseLeaveDatesWithValues(
            monthlyLeaveUsage.PaidLeaveDates,
            1.0 // Default value for paid leave
          );
          
          // Parse casual leave dates with values
          casualLeaveDates = LeaveModel.parseLeaveDatesWithValues(
            monthlyLeaveUsage.CasualLeaveDates,
            0.5 // Default value for casual leave
          );
        }
      } catch (err) {
        console.warn('[EmployeeSelfService] Could not fetch leave data from MonthlyLeaveUsage:', err);
        // Continue without leave data - attendance will still be returned
      }

      // Fetch regularization data directly from AttendanceRegularization table
      let regularizedDates: Array<{ date: string; value: number; originalStatus: string }> = [];
      
      try {
        const { AttendanceRegularizationModel } = await import('../models/AttendanceRegularizationModel.js');
        const { getMonthRange } = await import('../utils/date.js');
        
        // Get date range for the month (26th of previous month to 25th of current month)
        const { start, end } = getMonthRange(month);
        
        const regularizations = await AttendanceRegularizationModel.getRegularizationsByDateRange(
          employeeCode,
          start,
          end
        );
        
        // Convert regularizations to format needed for frontend
        regularizedDates = regularizations.map(reg => {
          // Format date as YYYY-MM-DD string
          const dateStr = reg.RegularizationDate instanceof Date 
            ? reg.RegularizationDate.toISOString().split('T')[0]
            : new Date(reg.RegularizationDate).toISOString().split('T')[0];
          
          // Determine regularization value based on regularized status
          const value = reg.RegularizedStatus === 'full-day' ? 1.0 : 0.5;
          
          return {
            date: dateStr,
            value: value,
            originalStatus: reg.OriginalStatus,
          };
        });
      } catch (err) {
        console.warn('[EmployeeSelfService] Could not fetch regularization data from AttendanceRegularization:', err);
        // Continue without regularization data - attendance will still be returned
      }

      // Enrich daily breakdown with leave and regularization information
      const enrichedDailyBreakdown = attendance.dailyBreakdown.map(day => {
        // Normalize date format for comparison (YYYY-MM-DD)
        // attendance.dailyBreakdown dates are already in YYYY-MM-DD format from formatDate()
        const dayDate = day.date.split('T')[0]; // Remove time portion if present
        
        // Find matching paid leave
        const isPaidLeave = paidLeaveDates.some(pl => {
          const plDate = pl.date.split('T')[0];
          return plDate === dayDate;
        });
        
        // Find matching casual leave
        const isCasualLeave = casualLeaveDates.some(cl => {
          const clDate = cl.date.split('T')[0];
          return clDate === dayDate;
        });
        
        // Find matching regularization
        const regularization = regularizedDates.find(reg => {
          const regDate = reg.date.split('T')[0];
          return regDate === dayDate;
        });
        
        return {
          ...day,
          isPaidLeave: isPaidLeave,
          isCasualLeave: isCasualLeave,
          isRegularized: !!regularization,
          regularizationValue: regularization?.value,
          regularizationOriginalStatus: regularization?.originalStatus,
        };
      });
      
      // Debug logging
      if (paidLeaveDates.length > 0 || casualLeaveDates.length > 0 || regularizedDates.length > 0) {
        console.log(`[EmployeeSelfService] Leave/Regularization data for ${employeeCode}, month ${month}:`, {
          paidLeaveDates: paidLeaveDates.map(pl => pl.date),
          casualLeaveDates: casualLeaveDates.map(cl => cl.date),
          regularizedDates: regularizedDates.map(reg => ({ date: reg.date, originalStatus: reg.originalStatus })),
          enrichedWithPL: enrichedDailyBreakdown.filter(d => d.isPaidLeave).map(d => d.date),
          enrichedWithCL: enrichedDailyBreakdown.filter(d => d.isCasualLeave).map(d => d.date),
          enrichedWithReg: enrichedDailyBreakdown.filter(d => d.isRegularized).map(d => d.date),
        });
      }

      // Calculate summary statistics
      const summary = {
        fullDays: attendance.fullDays,
        halfDays: attendance.halfDays,
        absentDays: attendance.absentDays,
        lateDays: attendance.lateDays || 0,
        earlyExits: attendance.earlyExits || 0,
        totalWorkedHours: attendance.totalWorkedHours,
      };

      res.json({
        success: true,
        data: {
          month: month,
          summary: summary,
          dailyBreakdown: enrichedDailyBreakdown,
          leaveInfo: {
            paidLeaveDates: paidLeaveDates,
            casualLeaveDates: casualLeaveDates,
            regularizedDates: regularizedDates,
          },
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error getting attendance:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/employee/salary/pdf?month=YYYY-MM
   * Download salary PDF for current employee (READ-ONLY from MonthlySalary)
   * 
   * SECURITY: Employee can only download their own salary PDF
   * NO CALCULATION: Only reads from stored MonthlySalary table
   * HOLD CHECK: Blocks download if salary is on HOLD
   */
  static async downloadSalaryPdf(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      const month = req.query.month as string || new Date().toISOString().slice(0, 7);
      
      if (!employeeCode || !req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // Read salary from MonthlySalary table (NO CALCULATION)
      // IMPORTANT: Only fetch FINALIZED salaries (Status = 1)
      // Employees must NOT download DRAFT salaries
      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const salaryRecord = await MonthlySalaryModel.getSalary(employeeCode, month, true);

      // If salary not found or not finalized, return NOT_FINALIZED status
      if (!salaryRecord) {
        res.status(404).json({
          success: false,
          status: 'NOT_FINALIZED',
          message: 'Salary not finalized yet. Please contact HR.',
        });
        return;
      }

      // Double-check Status = 1 (FINALIZED) - additional security check
      if (salaryRecord.Status !== 1) {
        res.status(403).json({
          success: false,
          status: 'NOT_FINALIZED',
          message: 'Salary not finalized yet.',
        });
        return;
      }

      // Check if salary is on HOLD - block PDF download
      if (salaryRecord.IsHeld) {
        res.status(403).json({
          success: false,
          status: 'HOLD',
          message: 'Salary is on HOLD. Please contact HR.',
          holdReason: salaryRecord.HoldReason,
        });
        return;
      }

      // Generate PDF from stored salary data
      const { generateSalaryPdf } = await import('../services/salaryPdfService.js');
      const pdfBuffer = await generateSalaryPdf(salaryRecord);

      // Set response headers for PDF download
      const monthName = new Date(`${month}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const fileName = `Salary_Report_${employeeCode}_${monthName.replace(/\s+/g, '_')}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      
      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error generating salary PDF:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/employee/salary/payslip?month=YYYY-MM
   * Download payslip PDF for current employee (READ-ONLY from MonthlySalary)
   * 
   * SECURITY: Employee can only download their own payslip PDF
   * NO CALCULATION: Only reads from stored MonthlySalary table
   * HOLD CHECK: Blocks download if salary is on HOLD
   */
  static async downloadPayslipPdf(req: Request, res: Response): Promise<void> {
    try {
      const employeeCode = req.employeeCode;
      const month = req.query.month as string || new Date().toISOString().slice(0, 7);
      
      if (!employeeCode || !req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: 'Invalid month format. Use YYYY-MM',
        });
        return;
      }

      // Read salary from MonthlySalary table (NO CALCULATION)
      // IMPORTANT: Only fetch FINALIZED salaries (Status = 1)
      // Employees must NOT download DRAFT salaries
      const { MonthlySalaryModel } = await import('../models/MonthlySalaryModel.js');
      const salaryRecord = await MonthlySalaryModel.getSalary(employeeCode, month, true);

      // If salary not found or not finalized, return NOT_FINALIZED status
      if (!salaryRecord) {
        res.status(404).json({
          success: false,
          status: 'NOT_FINALIZED',
          message: 'Salary not finalized yet. Please contact HR.',
        });
        return;
      }

      // Double-check Status = 1 (FINALIZED) - additional security check
      if (salaryRecord.Status !== 1) {
        res.status(403).json({
          success: false,
          status: 'NOT_FINALIZED',
          message: 'Salary not finalized yet.',
        });
        return;
      }

      // Check if salary is on HOLD - block PDF download
      if (salaryRecord.IsHeld) {
        res.status(403).json({
          success: false,
          status: 'HOLD',
          message: 'Salary is on HOLD. Please contact HR.',
          holdReason: salaryRecord.HoldReason,
        });
        return;
      }

      // Generate payslip PDF from stored salary data
      const { generatePayslipPdf } = await import('../services/salaryPdfService.js');
      const pdfBuffer = await generatePayslipPdf(salaryRecord);

      // Set response headers for PDF download
      const monthName = new Date(`${month}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const fileName = `Payslip_${employeeCode}_${monthName.replace(/\s+/g, '_')}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      
      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      const err = error as Error;
      console.error('[EmployeeSelfService] Error generating payslip PDF:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }
}

