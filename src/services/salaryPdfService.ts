/**
 * Salary PDF Generation Service
 * Generates salary report PDF from MonthlySalary snapshot data
 * 
 * PRINCIPLE: Uses ONLY stored MonthlySalary data - NO recalculation
 * This ensures admin and employee get IDENTICAL PDFs
 * 
 * Format matches admin portal PDF exactly
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlySalary } from '../models/MonthlySalaryModel.js';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';
import { calculateMonthlyHours } from './payroll.js';

interface EmployeeInfo {
  name: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  branchLocation: string | null;
  joinDate: string | null;
  exitDate: string | null;
  basicSalary: number | null;
}

interface SalaryBreakdown {
  perDayRate?: number;
  hourlyRate?: number;
  absentDeduction?: number;
  halfDayDeduction?: number;
  lateDeduction?: number;
  totalDeductions?: number;
  overtimeAmount?: number;
  sundayPay?: number;
  lopDeduction?: number;
  tdsDeduction?: number;
  professionalTax?: number;
  incentiveAmount?: number;
  adjustmentDeductions?: number;
  adjustmentAdditions?: number;
  adjustmentDetails?: Array<{
    category: string;
    type: 'DEDUCTION' | 'ADDITION';
    amount: number;
    description?: string;
  }>;
}

interface AttendanceData {
  fullDays: number;
  halfDays: number;
  absentDays: number;
  lateDays: number;
  lateBy30MinutesDays?: number;
  lateBy10MinutesDays?: number;
  sundaysInMonth?: number;
  totalPayableDays: number;
  totalDays: number;
  dailyBreakdown: Array<{
    date: string;
    status: string;
    firstEntry: string | null;
    lastExit: string | null;
    totalHours: number;
    isLate: boolean;
    minutesLate: number | null;
    isEarlyExit: boolean;
    logCount: number;
    weekoffType?: 'paid' | 'unpaid';
    originalStatus?: string;
    isRegularized?: boolean;
  }>;
}

/**
 * Generate salary PDF from MonthlySalary snapshot
 * This is the SINGLE SOURCE OF TRUTH for PDF generation
 * 
 * @param monthlySalary - Salary snapshot from MonthlySalary table
 * @param employeeInfo - Employee information (optional, will be fetched if not provided)
 * @returns PDF buffer
 */
export async function generateSalaryPdf(
  monthlySalary: MonthlySalary,
  employeeInfo?: EmployeeInfo
): Promise<Buffer> {
  // Fetch employee info if not provided
  if (!employeeInfo) {
    const employee = await EmployeeModel.getByCode(monthlySalary.EmployeeCode);
    const employeeDetails = await EmployeeDetailsModel.getByCode(monthlySalary.EmployeeCode);
    
    if (!employee) {
      throw new Error(`Employee ${monthlySalary.EmployeeCode} not found`);
    }
    
    employeeInfo = {
      name: employee.EmployeeName,
      employeeCode: employee.EmployeeCode,
      department: employeeDetails?.Department || null,
      designation: employeeDetails?.Designation || null,
      branchLocation: employeeDetails?.BranchLocation || null,
      joinDate: employeeDetails?.JoiningDate || null,
      exitDate: employeeDetails?.ExitDate || null,
      basicSalary: employeeDetails?.BasicSalary || null,
    };
  }
  
  // Parse complete breakdown JSON (contains ALL calculation data)
  interface CompleteBreakdown {
    breakdown?: SalaryBreakdown;
    attendance?: {
      fullDays: number;
      halfDays: number;
      absentDays: number;
      lateDays: number;
      lateBy30MinutesDays?: number;
      earlyExits: number;
      totalWorkedHours: number;
      overtimeHours: number;
      sundaysInMonth: number;
      totalPayableDays: number;
      totalDays: number;
    };
    dailyBreakdown?: Array<{
      date: string;
      status: string;
      firstEntry: string | null;
      lastExit: string | null;
      totalHours: number;
      isLate: boolean;
      minutesLate: number | null;
      isEarlyExit: boolean;
      logCount: number;
      weekoffType?: 'paid' | 'unpaid';
      originalStatus?: string;
      isRegularized?: boolean;
    }>;
    paidLeaveDates?: Array<{ date: string; value: number }>;
    casualLeaveDates?: Array<{ date: string; value: number }>;
    regularizedDates?: Array<{ date: string; value: number; originalStatus: string }>;
    leaveInfo?: any;
  }
  
  let storedData: CompleteBreakdown = {};
  let breakdown: SalaryBreakdown = {};
  let attendanceData: AttendanceData | null = null;
  let paidLeaveDates: Array<{ date: string; value: number }> = [];
  let casualLeaveDates: Array<{ date: string; value: number }> = [];
  let regularizedDates: Array<{ date: string; value: number; originalStatus: string }> = [];
  
  if (monthlySalary.BreakdownJson) {
    try {
      storedData = JSON.parse(monthlySalary.BreakdownJson);
      breakdown = storedData.breakdown || {};
      paidLeaveDates = storedData.paidLeaveDates || [];
      casualLeaveDates = storedData.casualLeaveDates || [];
      regularizedDates = storedData.regularizedDates || [];
      
      // Use stored attendance data if available
      if (storedData.attendance && storedData.dailyBreakdown) {
        attendanceData = {
          fullDays: storedData.attendance.fullDays || 0,
          halfDays: storedData.attendance.halfDays || 0,
          absentDays: storedData.attendance.absentDays || 0,
          lateDays: storedData.attendance.lateDays || 0,
          lateBy30MinutesDays: storedData.attendance.lateBy30MinutesDays,
          lateBy10MinutesDays: Math.max(0, (storedData.attendance.lateDays || 0) - (storedData.attendance.lateBy30MinutesDays || 0)),
          sundaysInMonth: storedData.attendance.sundaysInMonth || 0,
          totalPayableDays: storedData.attendance.totalPayableDays || monthlySalary.PaidDays || 0,
          totalDays: storedData.attendance.totalDays || 0,
          dailyBreakdown: storedData.dailyBreakdown,
        };
      }
    } catch (err) {
      console.warn('[SalaryPdfService] Failed to parse BreakdownJson:', err);
      // Fallback to basic breakdown if parsing fails
      breakdown = storedData as any;
    }
  }
  
  // If stored data is not available, try to fetch (fallback for old records)
  if (!attendanceData || !attendanceData.dailyBreakdown || attendanceData.dailyBreakdown.length === 0) {
    console.warn('[SalaryPdfService] Stored attendance data not available, attempting to fetch...');
    const employeeNo = parseInt(monthlySalary.EmployeeCode, 10);
    try {
      if (!isNaN(employeeNo)) {
        const attendance = await calculateMonthlyHours(
          employeeNo,
          monthlySalary.Month,
          employeeInfo.joinDate || undefined,
          employeeInfo.exitDate || undefined,
          paidLeaveDates,
          casualLeaveDates
        );
        
        // Helper function to get month range
        const getMonthRange = (month: string): { start: string; end: string } => {
          const [year, monthNum] = month.split('-').map(Number);
          const startDate = new Date(year, monthNum - 2, 26);
          const endDate = new Date(year, monthNum - 1, 25);
          const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          return { start, end };
        };
        
        const { start, end } = getMonthRange(monthlySalary.Month);
        const startDate = new Date(start);
        const endDate = new Date(end);
        const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        const paidSundays = attendance.dailyBreakdown.filter(
          day => day.status === 'weekoff' && (day as any).weekoffType === 'paid'
        ).length;
        
        attendanceData = {
          fullDays: attendance.fullDays,
          halfDays: attendance.halfDays,
          absentDays: attendance.absentDays,
          lateDays: attendance.lateDays,
          lateBy30MinutesDays: attendance.lateBy30MinutesDays,
          lateBy10MinutesDays: Math.max(0, attendance.lateDays - (attendance.lateBy30MinutesDays || 0)),
          sundaysInMonth: paidSundays,
          totalPayableDays: monthlySalary.PaidDays || 0,
          totalDays: totalDays,
          dailyBreakdown: attendance.dailyBreakdown,
        };
      }
    } catch (err) {
      console.warn('[SalaryPdfService] Failed to fetch attendance data:', err);
    }
  }
  
  // Create PDF document
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Helper function to format currency
  const formatPdfCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return 'Rs. 0.00';
    return 'Rs. ' + amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };
  
  // Header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageWidth - 14, 35);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SALARY REPORT', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 28, { align: 'center' });
  
  // Employee Information
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Information', 14, 42);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Left column
  const leftColX = 14;
  let currentY = 50;
  doc.text(`Name: ${employeeInfo.name}`, leftColX, currentY);
  currentY += 5;
  doc.text(`Employee Code: ${employeeInfo.employeeCode}`, leftColX, currentY);
  currentY += 5;
  doc.text(`Department: ${employeeInfo.department || 'N/A'}`, leftColX, currentY);
  currentY += 5;
  doc.text(`Designation: ${employeeInfo.designation || 'N/A'}`, leftColX, currentY);
  
  // Right column
  const rightColX = 110;
  currentY = 50;
  doc.text(`Join Date: ${formatDate(employeeInfo.joinDate)}`, rightColX, currentY);
  currentY += 5;
  
  if (employeeInfo.exitDate) {
    doc.text(`Exit Date: ${formatDate(employeeInfo.exitDate)}`, rightColX, currentY);
    currentY += 5;
  }
  
  doc.text(`Basic Salary: ${formatPdfCurrency(employeeInfo.basicSalary)}`, rightColX, currentY);
  currentY += 5;
  doc.text(`Location: ${employeeInfo.branchLocation || 'N/A'}`, rightColX, currentY);
  currentY += 5;
  doc.text(`Month: ${formatMonth(monthlySalary.Month)}`, rightColX, currentY);
  
  // Salary Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Salary Summary', 14, 75);
  
  // Build salary summary body
  const salaryBody: string[][] = [
    ['Base Salary', formatPdfCurrency(monthlySalary.BaseSalary)],
    ['Gross Salary', formatPdfCurrency(monthlySalary.GrossSalary)],
  ];
  
  // Add incentive if available
  if (breakdown.incentiveAmount && breakdown.incentiveAmount > 0) {
    salaryBody.push(['Incentive', `+${formatPdfCurrency(breakdown.incentiveAmount)}`]);
  }
  
  // Display individual adjustments from adjustmentDetails (exclude incentive as it's already shown above)
  if (breakdown.adjustmentDetails && breakdown.adjustmentDetails.length > 0) {
    breakdown.adjustmentDetails
      .filter(adj => adj.category !== 'INCENTIVE')
      .forEach(adj => {
        const categoryLabels: Record<string, string> = {
          'T_SHIRT': 'T-Shirt Deduction',
          'ADVANCE': 'Advance Deduction',
          'REIMBURSEMENT': 'Reimbursement',
        };
        const label = categoryLabels[adj.category] || adj.category;
        const sign = adj.type === 'DEDUCTION' ? '-' : '+';
        salaryBody.push([label, `${sign}${formatPdfCurrency(adj.amount)}`]);
      });
  }
  
  salaryBody.push(
    ['Total Deductions', `-${formatPdfCurrency(monthlySalary.TotalDeductions)}`],
    ['Net Salary', formatPdfCurrency(monthlySalary.NetSalary)]
  );
  
  autoTable(doc, {
    startY: 78,
    head: [['Description', 'Amount']],
    body: salaryBody,
    theme: 'plain',
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      cellPadding: 2,
      fontSize: 9
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      cellPadding: 2,
      fontSize: 9
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
  });
  
  // Attendance Summary
  const finalY1 = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CURRENT RUNNING CYCLE ATTENDANCE SUMMARY', 14, finalY1);
  
  // Calculate summary statistics from stored data (matching admin PDF logic)
  let presentDays = 0;
  let halfPresentDays = 0;
  let paidLeaveDays = 0;
  let casualLeaveDays = 0;
  let lossOfPayDays = 0;
  const totalDays = attendanceData?.totalDays || 0;
  const totalPayableDays = attendanceData?.totalPayableDays || monthlySalary.PaidDays || 0;
  const weekoffPaidDays = attendanceData?.sundaysInMonth || 0;
  
  // Calculate from daily breakdown using stored leave and regularization data
  if (attendanceData && attendanceData.dailyBreakdown) {
    attendanceData.dailyBreakdown.forEach(day => {
      // Check if this date has paid leave
      const paidLeaveItem = paidLeaveDates.find(d => d.date === day.date);
      if (paidLeaveItem) {
        paidLeaveDays += paidLeaveItem.value;
        return;
      }
      
      // Check if this date has casual leave
      const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
      if (casualLeaveItem) {
        casualLeaveDays += casualLeaveItem.value;
        // Also count the original status (half-day or absent)
        const originalStatus = (day as any).originalStatus || day.status;
        if (originalStatus === 'half-day') {
          halfPresentDays++; // Count the half-day that was worked
        }
        return;
      }
      
      // Check if this date is regularized
      const isRegularized = (day as any).isRegularized || regularizedDates.some(d => d.date === day.date);
      if (isRegularized) {
        const originalStatus = (day as any).originalStatus || day.status;
        if (originalStatus === 'half-day') {
          halfPresentDays++;
        } else if (day.status === 'full-day') {
          presentDays++;
        }
        return;
      }
      
      // Count normal attendance
      if (day.status === 'full-day') {
        presentDays++;
      } else if (day.status === 'half-day') {
        halfPresentDays++;
      } else if (day.status === 'absent') {
        lossOfPayDays++;
      }
      // Note: weekoffs are counted separately using backend value (weekoffPaidDays)
    });
  }
  
  // Calculate totals
  const totalPaidLeaveDays = paidLeaveDates.reduce((sum, item) => sum + item.value, 0);
  const totalCasualLeaveDays = casualLeaveDates.reduce((sum, item) => sum + item.value, 0);
  const totalLeaveAndLOP = lossOfPayDays + totalPaidLeaveDays + totalCasualLeaveDays;
  const payDays = totalPayableDays;
  
  // Build summary body
  const summaryBody = [
    ['Present', `${presentDays}`],
    ['Half Present', `${halfPresentDays}`],
    ['Paid Leave (PL)', `${paidLeaveDays}`],
    ['Casual Leave (CL)', `${casualLeaveDays.toFixed(1)}`],
    ['WO', `${weekoffPaidDays}`],
    ['LOP', `${lossOfPayDays}`],
    ['TOTAL', `${totalPayableDays.toFixed(1)}/${totalDays}`],
    ['LOP + PL + CL', `${totalLeaveAndLOP}`],
    ['PAY DAYS', `${payDays.toFixed(1)}`],
  ];
  
  autoTable(doc, {
    startY: finalY1 + 3,
    head: [['Metric', 'Value']],
    body: summaryBody,
    theme: 'plain',
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      cellPadding: 2,
      fontSize: 8
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      cellPadding: 2,
      fontSize: 8
    },
    didParseCell: function(data: any) {
      // Make PAY DAYS row bold
      if (data.row.index === summaryBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 70 }
    },
    margin: { left: 14, right: 14 },
  });
  
  const attendanceFinalY = (doc as any).lastAutoTable.finalY;
  
  // Salary Breakdown (formula table format)
  const finalY2 = attendanceFinalY + 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Salary Breakdown', 14, finalY2);
  
  // Get values for formulas
  const perDayRate = breakdown.perDayRate || monthlySalary.PerDayRate || 0;
  const hourlyRate = breakdown.hourlyRate || 0;
  const fullDaysCount = attendanceData?.fullDays || 0;
  const absentDays = attendanceData?.absentDays || 0;
  const lateDays = attendanceData?.lateDays || 0;
  const paidSundays = attendanceData?.sundaysInMonth || 0;
  const overtimeHours = monthlySalary.OvertimeHours || 0;
  const lopDeduction = breakdown.lopDeduction || 0;
  const tdsDeduction = breakdown.tdsDeduction || monthlySalary.TdsDeduction || 0;
  const professionalTax = breakdown.professionalTax || monthlySalary.ProfessionalTax || 0;
  const halfDays = attendanceData?.halfDays || 0;
  
  // Build formula table body
  const breakdownBody: string[][] = [];
  
  // Present Days Salary
  if (fullDaysCount > 0) {
    const presentSalary = fullDaysCount * perDayRate;
    breakdownBody.push([
      'Present Days Salary',
      `${fullDaysCount} days × ${formatPdfCurrency(perDayRate)} = ${formatPdfCurrency(presentSalary)}`
    ]);
  }
  
  // Half Day Salary
  if (halfDays > 0) {
    const halfDaySalary = halfDays * perDayRate * 0.5;
    breakdownBody.push([
      'Half Day Salary',
      `${halfDays} days × ${formatPdfCurrency(perDayRate)} × 0.5 = ${formatPdfCurrency(halfDaySalary)}`
    ]);
  }
  
  // Paid Leave Salary (using stored leave dates)
  const calcPaidLeaveDays = paidLeaveDates.reduce((sum, item) => sum + item.value, 0);
  if (calcPaidLeaveDays > 0) {
    const paidLeaveSalary = calcPaidLeaveDays * perDayRate;
    breakdownBody.push([
      'Paid Leave Salary',
      `${calcPaidLeaveDays} days × ${formatPdfCurrency(perDayRate)} = ${formatPdfCurrency(paidLeaveSalary)}`
    ]);
  }
  
  // Casual Leave Salary (using stored leave dates)
  const calcCasualLeaveDays = casualLeaveDates.reduce((sum, item) => sum + item.value, 0);
  if (calcCasualLeaveDays > 0) {
    const casualLeaveSalary = calcCasualLeaveDays * perDayRate;
    const casualLeaveDateCount = casualLeaveDates.length;
    const avgValuePerDate = casualLeaveDateCount > 0 ? calcCasualLeaveDays / casualLeaveDateCount : 0.5;
    breakdownBody.push([
      'Casual Leave Salary',
      `${casualLeaveDateCount} dates × ${formatPdfCurrency(perDayRate)} × ${avgValuePerDate.toFixed(1)} = ${formatPdfCurrency(casualLeaveSalary)} (${calcCasualLeaveDays.toFixed(1)} days)`
    ]);
  }
  
  // Sunday Pay
  if (paidSundays > 0 && breakdown.sundayPay && breakdown.sundayPay > 0) {
    breakdownBody.push([
      'Sunday Pay',
      `${paidSundays} days × ${formatPdfCurrency(perDayRate)} = +${formatPdfCurrency(breakdown.sundayPay)}`
    ]);
  }
  
  // Overtime
  if (overtimeHours > 0 && breakdown.overtimeAmount && breakdown.overtimeAmount > 0) {
    const overtimeMultiplier = hourlyRate > 0 ? breakdown.overtimeAmount / (overtimeHours * hourlyRate) : 1;
    breakdownBody.push([
      'Overtime',
      `${overtimeHours.toFixed(2)} hrs × ${formatPdfCurrency(hourlyRate)} × ${overtimeMultiplier.toFixed(2)} = +${formatPdfCurrency(breakdown.overtimeAmount)}`
    ]);
  }
  
  // Late Deduction
  if (lateDays > 0 && breakdown.lateDeduction && breakdown.lateDeduction > 0) {
    const lateBy30MinutesDays = attendanceData?.lateBy30MinutesDays || 0;
    const lateBy10MinutesDays = attendanceData?.lateBy10MinutesDays || Math.max(0, lateDays - lateBy30MinutesDays);
    const lateDays10MinExceedingGrace = Math.max(0, lateBy10MinutesDays - 3); // Grace period: 3 days
    const actualLateDeductionDays = lateBy30MinutesDays + lateDays10MinExceedingGrace;
    
    // Calculate per-day deduction rate
    let lateDeductionPerDay = 0;
    if (actualLateDeductionDays > 0) {
      lateDeductionPerDay = breakdown.lateDeduction / actualLateDeductionDays;
    } else {
      lateDeductionPerDay = breakdown.lateDeduction / lateDays;
    }
    
    breakdownBody.push([
      'Late Deduction',
      `${actualLateDeductionDays} days × ${formatPdfCurrency(lateDeductionPerDay)} = -${formatPdfCurrency(breakdown.lateDeduction)}`
    ]);
  }
  
  // Absent Deduction
  if (absentDays > 0) {
    const absentDaysDeduction = absentDays * perDayRate;
    breakdownBody.push([
      'Absent Deduction',
      `${absentDays} days × ${formatPdfCurrency(perDayRate)} = -${formatPdfCurrency(absentDaysDeduction)}`
    ]);
  }
  
  // Half Day Deduction
  if (halfDays > 0 && breakdown.halfDayDeduction && breakdown.halfDayDeduction > 0) {
    breakdownBody.push([
      'Half Day Deduction',
      `${halfDays} days × ${formatPdfCurrency(perDayRate)} × 0.5 = -${formatPdfCurrency(breakdown.halfDayDeduction)}`
    ]);
  }
  
  // Loss of Pay Deduction
  if (lopDeduction > 0) {
    const lopDays = perDayRate > 0 ? lopDeduction / perDayRate : 0;
    breakdownBody.push([
      'Loss of Pay (LOP)',
      `${lopDays.toFixed(1)} × ${formatPdfCurrency(perDayRate)} = -${formatPdfCurrency(lopDeduction)}`
    ]);
  }
  
  // TDS Deduction
  if (tdsDeduction > 0) {
    breakdownBody.push([
      'TDS Deduction',
      `10% of Net Salary = -${formatPdfCurrency(tdsDeduction)}`
    ]);
  }
  
  // Professional Tax
  if (professionalTax > 0) {
    breakdownBody.push([
      'Professional Tax',
      ` - ${formatPdfCurrency(professionalTax)}`
    ]);
  }
  
  if (breakdownBody.length > 0) {
    autoTable(doc, {
      startY: finalY2 + 3,
      head: [['Component', 'Calculation']],
      body: breakdownBody,
      theme: 'plain',
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
        cellPadding: 3,
        fontSize: 8
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
        cellPadding: 3,
        fontSize: 8
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'left', cellWidth: 110, fontSize: 7 }
      },
      margin: { left: 14, right: 14 },
    });
  }
  
  // Daily Attendance List (New Page)
  if (attendanceData && attendanceData.dailyBreakdown && attendanceData.dailyBreakdown.length > 0) {
    doc.addPage();
    
    // Minimal header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, 20, pageWidth - 14, 20);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY ATTENDANCE RECORD', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Daily Attendance of: ${employeeInfo.employeeCode}`, 14, 28);
    
    // Prepare attendance data
    const attendanceTableData = attendanceData.dailyBreakdown.map(day => {
      const date = new Date(day.date);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const firstEntry = day.firstEntry ? new Date(day.firstEntry).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const lastExit = day.lastExit ? new Date(day.lastExit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const hours = day.totalHours.toFixed(2);
      const status = day.status.toUpperCase();
      
      // Build flags
      let lateFlag = '';
      if (day.isLate && day.minutesLate !== null && day.minutesLate !== undefined) {
        lateFlag = `LATE (${day.minutesLate} min)`;
      }
      
      const flags = [
        lateFlag,
        day.isEarlyExit ? 'EARLY EXIT' : ''
      ].filter(Boolean).join(', ');
      
      // Check if this date has approved leave, regularization, or weekoff payment status
      const isRegularized = (day as any).isRegularized || regularizedDates.some(d => d.date === day.date);
      let leaveStatus = '';
      if (isRegularized) {
        const originalStatus = (day as any).originalStatus || (day.status === 'full-day' ? 'absent' : day.status);
        leaveStatus = `REG (${originalStatus.toUpperCase()})`;
      } else if (paidLeaveDates.find(d => d.date === day.date)) {
        leaveStatus = 'PAID LEAVE';
      } else if (casualLeaveDates.find(d => d.date === day.date)) {
        leaveStatus = 'CASUAL LEAVE';
      } else if (day.status === 'weekoff') {
        const weekoffType = (day as any).weekoffType;
        leaveStatus = weekoffType === 'paid' ? 'PAID' : 'UNPAID';
      }
      
      // Calculate attendance value (matching admin PDF logic exactly)
      let attendanceValue = '0';
      
      // Check if it's a paid leave first (overrides other statuses)
      if (paidLeaveDates.find(d => d.date === day.date)) {
        attendanceValue = '1';
      } else if (isRegularized) {
        // Regularized dates: get the regularization value and original status
        const regItem = regularizedDates.find(d => d.date === day.date);
        const originalStatus = (day as any).originalStatus || day.status;
        const currentStatus = day.status;
        
        // Calculate hours worked before regularization
        let originalHoursWorked = 0;
        if (originalStatus === 'half-day') {
          originalHoursWorked = 0.5;
        } else if (originalStatus === 'absent') {
          originalHoursWorked = 0;
        } else if (originalStatus === 'full-day') {
          originalHoursWorked = 1.0;
        }
        
        // Get regularization value
        let regularizationValue: number;
        if (regItem && regItem.value !== undefined && regItem.value !== null) {
          regularizationValue = regItem.value;
        } else {
          if (currentStatus === 'half-day') {
            regularizationValue = 0.5 - originalHoursWorked;
          } else if (currentStatus === 'full-day') {
            regularizationValue = 1.0 - originalHoursWorked;
          } else {
            regularizationValue = 1.0;
          }
        }
        
        const totalValue = originalHoursWorked + regularizationValue;
        attendanceValue = String(Math.min(totalValue, 1.0));
      } else if (casualLeaveDates.find(d => d.date === day.date)) {
        // Casual leave: get the actual value (0.5 or 1.0) and check original status
        const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
        const casualLeaveValue = casualLeaveItem?.value || 0.5;
        const originalStatus = (day as any).originalStatus || day.status;
        
        if (originalStatus === 'half-day') {
          attendanceValue = String(Math.min(0.5 + casualLeaveValue, 1.0));
        } else if (originalStatus === 'absent') {
          attendanceValue = String(casualLeaveValue);
        } else {
          attendanceValue = String(casualLeaveValue);
        }
      } else if (day.status === 'full-day') {
        attendanceValue = '1';
      } else if (day.status === 'half-day') {
        attendanceValue = '0.5';
      } else if (day.status === 'absent') {
        attendanceValue = '0';
      } else if (day.status === 'weekoff') {
        attendanceValue = (day as any).weekoffType === 'paid' ? '1' : '0';
      } else if (day.status === 'not-active') {
        attendanceValue = '0';
      }
      
      return [
        dateStr,
        firstEntry,
        lastExit,
        hours,
        status,
        flags,
        leaveStatus,
        attendanceValue,
      ];
    });
    
    // Calculate total of attendance values (using the same logic as above)
    const totalValue = attendanceTableData.reduce((sum, row) => {
      const value = parseFloat(row[7] || '0'); // Value is in column 7 (index 7)
      return sum + value;
    }, 0);
    
    // Add total row
    attendanceTableData.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      totalValue.toFixed(2)
    ]);
    
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'First Entry', 'Last Exit', 'Hours', 'Status', 'Flags', 'Leave', 'Value']],
      body: attendanceTableData,
      theme: 'plain',
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7,
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
        textColor: [0, 0, 0],
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      didParseCell: function(data: any) {
        // Style the total row (last row)
        if (data.row.index === attendanceTableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.lineWidth = 0.5;
          data.cell.styles.lineColor = [0, 0, 0];
          // Make the first column (TOTAL) and last column (total value) bold
          if (data.column.index === 0 || data.column.index === 7) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 32, fontSize: 7 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }
  
  // Salary Status
  const finalY3 = attendanceData && attendanceData.dailyBreakdown && attendanceData.dailyBreakdown.length > 0 
    ? (doc as any).lastAutoTable.finalY + 6 
    : (doc as any).lastAutoTable.finalY + 6;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Status:', 14, finalY3);
  doc.setFont('helvetica');
  doc.text(monthlySalary.IsHeld ? 'ON HOLD' : 'PAID', 100, finalY3);
  if (monthlySalary.IsHeld && monthlySalary.HoldReason) {
    doc.text(`Reason: ${monthlySalary.HoldReason}`, 14, finalY3 + 10);
  }
  
  // Footer on all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Return PDF as buffer
  return Buffer.from(doc.output('arraybuffer'));
}

// Helper functions
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatMonth(monthStr: string): string {
  try {
    return new Date(`${monthStr}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  } catch {
    return monthStr;
  }
}

