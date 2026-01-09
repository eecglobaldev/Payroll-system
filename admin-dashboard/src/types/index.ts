// Employee Types
export interface Employee {
  employeeNo: string;
  name: string;
  department: string;
  designation: string;
  fullBasic: number;
  monthlyCTC: number;
  annualCTC: number;
  joinDate: string;
  status: string;
  location: string;
  joiningDate?: string; // From EmployeeDetails API
  exitDate?: string | null; // From EmployeeDetails API
  isActive?: boolean; // From EmployeeDetails API
  shift?: string | null; // Shift name from EmployeeDetails API
  BankAccountNo: string;
  IFSCcode: string;
}

// Attendance Types
export interface AttendanceLog {
  DeviceLogId: number;
  UserId: number;
  LogDate: string;
  Direction: string;
  DeviceId: number;
}

export interface DailyAttendance {
  date: string;
  firstEntry: string | null;
  lastExit: string | null;
  totalHours: number;
  isLate: boolean;
  minutesLate: number | null; // Minutes late from shift start time (null if not late or can't calculate)
  isEarlyExit: boolean;
  status: 'full-day' | 'half-day' | 'absent' | 'not-active' | 'weekoff';
  logCount: number;
  weekoffType?: 'paid' | 'unpaid'; // Only present when status is 'weekoff'
}

export interface AttendanceSummary {
  userId: number;
  month: string;
  summary: {
    totalWorkedHours: number;
    fullDays: number;
    halfDays: number;
    absentDays: number;
    lateDays: number;
    earlyExits: number;
  };
  dailyBreakdown: DailyAttendance[];
}

// Salary Types
export interface SalaryBreakdown {
  perDayRate: number;
  hourlyRate: number;
  absentDeduction: number;
  halfDayDeduction: number;
  lateDeduction: number;
  totalDeductions: number;
  overtimeAmount: number;
  sundayPay: number;
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

export interface AttendanceInfo {
  totalDays: number;
  expectedWorkingDays: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
  lateDays: number;
  earlyExits: number;
  totalWorkedHours: number;
  expectedHours: number;
  overtimeHours: number;
  isOvertimeEnabled?: boolean; // Whether overtime is enabled for this employee for this month
  sundaysInMonth: number;
  actualDaysWorked: number;
  totalPayableDays: number;
}

export interface SalaryCalculation {
  employeeCode: string;
  employeeName?: string; // From Employees table (optional)
  month: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  attendance: AttendanceInfo;
  breakdown: SalaryBreakdown;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  message?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalEmployees: number;
  todayAttendance: number;
  monthlySalary: number;
  averageWorkHours: number;
}

// Leave Types
export interface LeaveDateWithValue {
  date: string; // Format: 'YYYY-MM-DD'
  value: number; // 0.5 for half-day, 1.0 for full-day
}

