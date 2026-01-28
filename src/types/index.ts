/**
 * TypeScript Type Definitions
 * Shared types and interfaces for the Payroll & Attendance API
 */

// PostgreSQL query result type (compatible with SQL Server format)

/* ===================================
 * Configuration Types
 * ================================ */

export interface DatabaseConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
    connectTimeout: number;
    requestTimeout: number;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
}

export interface PayrollConfig {
  defaultWorkHoursPerDay: number;
  lateEntryThresholdMinutes: number;
  earlyExitThresholdMinutes: number;
  overtimeRateMultiplier: number;
  halfDayHoursThreshold: number;
}

/* ===================================
 * Database Record Types
 * ================================ */

export interface AttendanceLog {
  DeviceLogId: number;
  DownloadDate: Date;
  DeviceId: number;
  UserId: number;
  LogDate: Date;
  Direction: string;
  AttDirection: string;
  C1: string | null;
  C2: string | null;
  C3: string | null;
  C4: number;
  C5: number;
  C6: string | null;
  C7: string | null;
  WorkCode: string | null;
  UpdateFlag: number;
  EmployeeImage: string | null;
  FileName: string | null;
  Longitude: number;
  Latitude: number;
  IsApproved: number;
  CreatedDate: Date;
  LastModifiedDate: Date | null;
  LocationAddress: string | null;
  BodyTemperature: number;
  IsMaskOn: number;
}

export interface Employee {
  EmployeeId: number; // Primary key (int)
  EmployeeCode: string; // PK - nvarchar(50)
  EmployeeName: string; // Employee's full name - nvarchar(50)
  StringCode?: string; // nvarchar(50)
  NumericCode?: number; // int
  Gender?: string; // nvarchar(255)
  CompanyId?: number; // int
  DepartmentId?: number; // int
  Designation?: string; // nvarchar(255)
  CategoryId?: number; // int
  // Note: IsActive, BaseSalary, HourlyRate, JoinDate columns don't exist in actual DB
  // These columns exist in Employees table but not commonly used:
  Department?: string; // For compatibility with frontend
}

/**
 * EmployeeDetails - HR and Salary Data from Database
 * Replaces Excel as the source of employee salary and HR data
 * 
 * IMPORTANT: EmployeeCode must match Employees.EmployeeCode
 */
/**
 * Shift - Shift timing information
 */
export interface Shift {
  ShiftId: number;
  ShiftName: string; // e.g., "D", "B", "C", "W", "SPLIT-A"
  StartTime: string | Date; // Time in 'HH:MM:SS' format (e.g., "10:00:00") or Date object from SQL Server
  EndTime: string | Date; // Time in 'HH:MM:SS' format (e.g., "19:00:00") or Date object from SQL Server
  IsSplitShift: boolean; // If true, use split shift times instead of StartTime/EndTime
  StartTime_1?: string | Date | null; // First slot start time (for split shifts)
  EndTime_1?: string | Date | null; // First slot end time (for split shifts)
  StartTime_2?: string | Date | null; // Second slot start time (for split shifts)
  EndTime_2?: string | Date | null; // Second slot end time (for split shifts)
  WorkHours: number; // Total work hours (e.g., 9.00)
  LateThresholdMinutes: number; // Minutes after start time to be considered late (default 10)
  CreatedAt?: Date;
  UpdatedAt?: Date | null;
}

/**
 * Shift timing for calculations (parsed from Shift)
 */
export interface ShiftTiming {
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
  workHours: number; // Total work hours per day
  lateThresholdMinutes: number; // Minutes after start time
  isSplitShift: boolean; // If true, use slot times
  slot1?: { startHour: number; startMinute: number; endHour: number; endMinute: number } | null;
  slot2?: { startHour: number; startMinute: number; endHour: number; endMinute: number } | null;
}

/**
 * Employee Shift Assignment - Date-wise shift assignment
 * Allows multiple shifts per employee within a month
 */
export interface EmployeeShiftAssignment {
  Id?: number; // Auto-generated primary key
  EmployeeCode: string; // References Employees.EmployeeCode
  ShiftName: string; // References Employee_Shifts.ShiftName
  FromDate: string; // Date in 'YYYY-MM-DD' format (inclusive)
  ToDate: string; // Date in 'YYYY-MM-DD' format (inclusive)
  CreatedAt?: Date;
}

/**
 * Request payload for creating shift assignment
 */
export interface CreateShiftAssignmentRequest {
  employeeCode: string;
  shiftName: string;
  fromDate: string; // 'YYYY-MM-DD'
  toDate: string; // 'YYYY-MM-DD'
}

export interface EmployeeDetails {
  EmployeeDetailsId?: number; // Auto-generated primary key
  EmployeeCode: string; // MUST match Employees.EmployeeCode
  JoiningDate: string | null; // Date in 'YYYY-MM-DD' format
  ExitDate: string | null; // NULL = active; NOT NULL = exited
  BranchLocation: string | null;
  Department: string | null;
  Designation: string | null;
  BasicSalary: number; // Monthly basic salary (INR)
  MonthlyCTC: number | null; // Monthly Cost to Company
  AnnualCTC: number | null; // Annual Cost to Company
  Gender: string | null; // 'Male', 'Female', 'Other'
  PhoneNumber: string | null;
  Shift: string | null; // Shift name (references Shifts.ShiftName)
  BankAccNo: string | null; // Bank Account Number
  IFSCCode: string | null; // IFSC Code
  CreatedAt?: Date;
  UpdatedAt?: Date | null;
  CreatedBy?: string | null;
  UpdatedBy?: string | null;
}

/**
 * Request payload for creating/updating employee details
 */
export interface CreateEmployeeDetailsRequest {
  employeeCode: string;
  joiningDate?: string | null;
  branchLocation?: string | null;
  department?: string | null;
  designation?: string | null;
  basicSalary: number;
  monthlyCTC?: number | null;
  annualCTC?: number | null;
  gender?: string | null;
  phoneNumber?: string | null;
  shift?: string | null; // Shift name
  BankAccNo?: string | null;
  IFSCCode?: string | null;
  createdBy?: string | null;
}

export interface UpdateEmployeeDetailsRequest {
  joiningDate?: string | null;
  exitDate?: string | null;
  branchLocation?: string | null;
  department?: string | null;
  designation?: string | null;
  basicSalary?: number;
  monthlyCTC?: number | null;
  annualCTC?: number | null;
  gender?: string | null;
  phoneNumber?: string | null;
  shift?: string | null; // Shift name
  BankAccNo?: string | null;
  IFSCCode?: string | null;
  updatedBy?: string | null;
}

/**
 * Combined employee data (from Employees + EmployeeDetails tables)
 * Used by frontend for display
 */
export interface EmployeeWithDetails {
  employeeNo: string;
  name: string;
  department: string | null;
  designation: string | null;
  basicSalary: number;
  monthlyCTC: number | null;
  annualCTC: number | null;
  joiningDate: string | null;
  exitDate: string | null;
  branchLocation: string | null;
  gender: string | null;
  phoneNumber: string | null;
  shift: string | null; // Shift name
  bankAccNo: string | null; // Bank Account Number
  ifscCode: string | null; // IFSC Code
  isActive: boolean; // Computed: exitDate === null
}

/* ===================================
 * API Request/Response Types
 * ================================ */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface DateRangeQuery {
  start: string;
  end: string;
}

export interface MonthQuery {
  month?: string;
}

/* ===================================
 * Attendance Types
 * ================================ */

export interface AttendanceSummary {
  UserId: number;
  DaysPresent: number;
  TotalLogs: number;
  FirstEntry: Date;
  LastEntry: Date;
}

export interface DayHours {
  firstEntry: string | null;
  lastExit: string | null;
  totalHours: number;
  isLate: boolean;
  isLateBy30Minutes: boolean; // True if late by 30+ minutes from reporting time
  minutesLate: number | null; // Minutes late from shift start time (null if not late or can't calculate)
  isEarlyExit: boolean;
  status: 'present' | 'absent' | 'half-day' | 'full-day' | 'partial' | 'not-active' | 'weekoff' | 'paid-leave' | 'casual-leave' | 'holiday';
  logCount: number;
  weekoffType?: 'paid' | 'unpaid'; // Only present when status is 'weekoff'
}

export interface DailyBreakdown extends DayHours {
  date: string;
}

/* ===================================
 * Payroll Types
 * ================================ */

export interface MonthlyAttendance {
  employeeCode: string;
  month: string;
  totalDaysInMonth: number;
  totalWorkedHours: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  lateDays: number;
  lateBy30MinutesDays: number; // Count of days late by 30+ minutes
  earlyExits: number;
  dailyBreakdown: DailyBreakdown[];
}

export interface SalaryBreakdown {
  perDayRate: number;
  hourlyRate: number;
  absentDeduction: number;
  halfDayDeduction: number;
  lateDeduction?: number; // Total late deduction (sum of both types)
  lateDeduction30Minutes?: number; // 50% deduction for late by 30+ minutes
  lateDeduction10Minutes?: number; // 25% deduction for 10+ min late days exceeding grace period
  totalDeductions?: number;
  overtimeAmount: number;
  sundayPay: number; // Amount paid for Sundays
  lopDeduction?: number; // Loss of Pay deduction (when leaves exceed entitlement)
  tdsDeduction?: number; // TDS deduction (10% if basic salary < 15000)
  professionalTax?: number; // Professional tax (₹200 if basic salary >= 15000)
  adjustmentDeductions?: number; // Salary adjustment deductions (e.g., T-shirt cost)
  adjustmentAdditions?: number; // Salary adjustment additions (excluding incentive, e.g., reimbursements)
  incentiveAmount?: number; // Incentive amount (added to gross salary, not net salary)
  adjustmentDetails?: Array<{ // Detailed breakdown of adjustments
    type: string;
    category: string;
    amount: number;
    description?: string;
  }>;
}

export interface AttendanceStats {
  dailyBreakdown?: DailyBreakdown[]; // Include daily breakdown with updated weekoff payment status
  totalDays: number;
  isOvertimeEnabled?: boolean; // Whether overtime is enabled for this employee for this month
  expectedWorkingDays: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  lateDays: number; // Total late days (all late entries)
  lateBy30MinutesDays: number; // Count of days late by 30+ minutes
  lateBy10MinutesDays: number; // Count of days late by 10+ minutes (but not 30+ minutes)
  earlyExits: number;
  totalWorkedHours: number;
  expectedHours: number;
  overtimeHours: number;
  sundaysInMonth: number; // Number of Sundays (paid days off)
  actualDaysWorked: number; // Days actually worked (excluding Sundays)
  totalPayableDays: number; // Worked days + Sundays
}

export interface SalaryCalculation {
  employeeCode: string;
  employeeName?: string; // From Employees table (not Excel)
  month: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  attendance: AttendanceStats;
  breakdown: SalaryBreakdown;
  leaveInfo?: { // Leave balance information
    allowedLeaves: number;
    usedPaidLeaves: number;
    usedCasualLeaves: number;
    remainingLeaves: number;
    isExceeded: boolean;
    lossOfPayDays: number;
  };
}

export interface BaseSalaryInfo {
  baseSalary: number;
  hourlyRate: number | null;
}

/* ===================================
 * Utility Types
 * ================================ */

export interface DateRange {
  start: string;
  end: string;
}

export interface ValidationResult<T = any> {
  error: string | null;
  value: T | null;
}

/* ===================================
 * Express Custom Types
 * ================================ */

declare global {
  namespace Express {
    interface Request {
      employeeCode?: string;
    }
  }
}

export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

/* ===================================
 * Database Query Types
 * ================================ */

// QueryResult type for compatibility with existing code
export interface QueryResult<T = any> {
  recordset: T[];
  rowsAffected: number[];
  returnValue: number;
}

export interface QueryParameters {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/* ===================================
 * Batch Operation Types
 * ================================ */

export interface BatchSalaryRequest {
  employeeCodes: string[];
  month?: string;
}

export interface BatchSalaryResponse {
  success: boolean;
  month: string;
  processed: number;
  failed: number;
  data: SalaryCalculation[];
  errors?: Array<{
    employeeCode: string;
    error: string;
  }>;
}

/* ===================================
 * Error Types
 * ================================ */

export interface ApiError {
  error: string;
  message: string;
  details?: string;
  statusCode?: number;
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/* ===================================
 * Leave Management Types
 * ================================ */

/**
 * EmployeeLeaves - Annual leave entitlement from database
 * Tracks: AllowedLeaves (annual quota), UsedPaidLeaves, UsedCasualLeaves (cumulative)
 */
export interface EmployeeLeaveEntitlement {
  EmployeeLeavesId: number;
  EmployeeCode: string; // Links to Employees.EmployeeCode (PK)
  LeaveTypeId: number;
  LeaveYear: number;
  AllowedLeaves: number; // Annual entitlement (e.g., 12 days)
  UsedPaidLeaves: number; // Cumulative paid leaves used in the year
  UsedCasualLeaves: number; // Cumulative casual leaves used in the year
}

/**
 * Leave date with explicit value (0.5 or 1.0)
 * This allows both PL and CL to support both half-day and full-day values
 */
export interface LeaveDateWithValue {
  date: string; // Format: 'YYYY-MM-DD'
  value: number; // 0.5 for half-day, 1.0 for full-day
}

/**
 * MonthlyLeaveUsage - Monthly leave approvals from database
 * Stores which specific dates were approved as paid/casual leave per month
 * This is the source of truth for salary calculation
 * 
 * PaidLeaveDates and CasualLeaveDates can be:
 * - JSON string: '[{"date":"2025-11-06","value":1},{"date":"2025-11-15","value":0.5}]'
 * - Comma-separated string (legacy): '2025-11-06,2025-11-15' (backward compatibility)
 */
export interface MonthlyLeaveUsage {
  MonthlyLeaveUsageId?: number;
  EmployeeCode: string; // Links to Employees.EmployeeCode (PK)
  LeaveMonth: string; // Format: 'YYYY-MM' (e.g., '2025-11')
  PaidLeaveDaysUsed: number; // Sum of paid leave values (calculated from PaidLeaveDates)
  CasualLeaveDaysUsed: number; // Sum of casual leave values (calculated from CasualLeaveDates)
  PaidLeaveDates: string | null; // JSON string or comma-separated dates (backward compatible)
  CasualLeaveDates: string | null; // JSON string or comma-separated dates (backward compatible)
  CreatedAt?: Date;
  UpdatedAt?: Date;
  UpdatedBy?: string | null; // Admin who approved
}

/**
 * Request payload for saving leave approvals
 * Now supports explicit values (0.5 or 1.0) for each date
 */
export interface SaveLeaveApprovalRequest {
  employeeCode: string; // Employee code (matches Employees.EmployeeCode PK)
  month: string; // Format: 'YYYY-MM'
  paidLeaveDates: LeaveDateWithValue[]; // Array of { date, value } objects
  casualLeaveDates: LeaveDateWithValue[]; // Array of { date, value } objects
  approvedBy?: string; // Admin username/ID
}

/**
 * Response with leave entitlement and usage
 */
export interface LeaveBalance {
  employeeCode: string;
  employeeName: string;
  year: number;
  allowedLeaves: number; // Annual entitlement
  usedPaidLeaves: number; // Annual total of paid leaves used
  usedCasualLeaves: number; // Annual total of casual leaves used
  remainingLeaves: number; // Calculated: allowedLeaves - (usedPaidLeaves + usedCasualLeaves)
  monthlyUsage?: MonthlyLeaveUsage; // Optional: specific month's usage
}

/**
 * Extended salary calculation that includes leave information
 */
export interface SalaryWithLeaveInfo extends SalaryCalculation {
  leaveInfo?: {
    allowedLeaves: number;
    usedPaidLeaves: number;
    usedCasualLeaves: number;
    remainingLeaves: number;
    isExceeded: boolean; // True if used leaves exceed allowed
    lossOfPayDays: number; // Days deducted due to exceeding limit
  };
}

