
export enum AttendanceStatus {
  PRESENT = 'Present',
  HALF = 'Half',
  ABSENT = 'Absent',
  LEAVE = 'Leave',
  WEEK_OFF = 'Week Off'
}

export enum SalaryStatus {
  PAID = 'PAID',
  HOLD = 'HOLD'
}

export enum LeaveStatus {
  APPROVED = 'Approved',
  PENDING = 'Pending',
  REJECTED = 'Rejected'
}

export interface User {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  joinDate: string;
}

export interface SalaryRecord {
  id: string;
  month: string;
  year: number;
  grossSalary: number;
  netSalary: number;
  baseSalary?: number;
  perDayRate?: number;
  status: SalaryStatus;
  paymentDate?: string;
}

export interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
  shift: string;
  firstEntry?: string | null; // ISO string from backend
  lastExit?: string | null; // ISO string from backend
  checkIn?: string; // Formatted time (for backward compatibility)
  checkOut?: string; // Formatted time (for backward compatibility)
  totalHours?: number;
  isLate?: boolean;
  minutesLate?: number | null;
  isEarlyExit?: boolean;
  logCount?: number;
  isPaidLeave?: boolean;
  isCasualLeave?: boolean;
  isRegularized?: boolean;
  regularizationValue?: number;
  regularizationOriginalStatus?: string;
}

export interface AttendanceSummary {
  month: string;
  summary: {
    fullDays: number;
    halfDays: number;
    absentDays: number;
    lateDays: number;
    earlyExits: number;
    totalWorkedHours: number;
  };
  dailyBreakdown: AttendanceRecord[];
}

export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason: string;
}

export interface CompanyDocument {
  id: string;
  name: string;
  category: 'Payroll' | 'Policy' | 'Tax' | 'Legal';
  uploadDate: string;
  size: string;
}

export interface HRTask {
  id: string;
  title: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
}
