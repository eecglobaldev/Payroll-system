/**
 * Centralized API Service Layer
 * Handles all API calls with automatic JWT token attachment
 * Auto-logout on 401 responses
 */

import { API_BASE_URL } from '../src/config/env';
import { SalaryRecord, SalaryStatus, AttendanceRecord, AttendanceStatus, User } from '../types';

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Login response
interface LoginResponse {
  token: string;
  employeeCode: string;
  role: string;
}

/**
 * Get JWT token from localStorage
 */
const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Handle 401 Unauthorized - Auto logout
 */
const handleUnauthorized = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

/**
 * Make authenticated API request
 */
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }

  const data: ApiResponse<T> = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || data.message || 'API request failed');
  }

  return data.data as T;
};

/**
 * OTP Authentication APIs
 */

/**
 * Send OTP to employee
 */
export const sendOTP = async (employeeCode: string): Promise<void> => {
  const url = `${API_BASE_URL}/auth/employee/send-otp`;
  const requestBody = { employeeCode };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to send OTP' }));
      throw new Error(errorData.error || errorData.message || 'Failed to send OTP');
    }

    const data: ApiResponse<void> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || data.message || 'Failed to send OTP');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Verify OTP and get JWT token
 */
export const verifyOTP = async (employeeCode: string, otp: string): Promise<LoginResponse> => {
  const url = `${API_BASE_URL}/auth/employee/verify-otp`;
  const requestBody = { employeeCode, otp };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'OTP verification failed' }));
      throw new Error(errorData.error || errorData.message || 'Invalid OTP');
    }

    const data: ApiResponse<LoginResponse> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || data.message || 'OTP verification failed');
    }

    return data.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Resend OTP
 */
export const resendOTP = async (employeeCode: string): Promise<void> => {
  const url = `${API_BASE_URL}/auth/employee/resend-otp`;
  const requestBody = { employeeCode };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to resend OTP' }));
      throw new Error(errorData.error || errorData.message || 'Failed to resend OTP');
    }

    const data: ApiResponse<void> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || data.message || 'Failed to resend OTP');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Get current employee profile
 */
export const getEmployeeProfile = async (): Promise<User> => {
  return apiRequest<User>('/employee/me');
};

/**
 * Update employee profile
 */
export const updateEmployeeProfile = async (updates: Partial<User>): Promise<User> => {
  return apiRequest<User>('/employee/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

/**
 * Change password
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  return apiRequest<void>('/employee/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

/**
 * Get current month salary
 * Returns null if salary is NOT_GENERATED
 */
export const getCurrentSalary = async (month?: string): Promise<SalaryRecord | null> => {
  const monthParam = month ? `?month=${month}` : '';
  
  try {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/employee/salary${monthParam}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized - Please login again');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    const responseData = await response.json();
    
    // Check if salary is not generated yet or not finalized (status: NOT_GENERATED or NOT_FINALIZED)
    // But still return baseSalary and perDayRate from EmployeeDetails if available
    if (responseData.status === 'NOT_GENERATED' || responseData.status === 'NOT_FINALIZED') {
      // Even if salary not generated, return base salary and per day rate from EmployeeDetails
      if (responseData.baseSalary || responseData.perDayRate) {
        const currentMonth = month || new Date().toISOString().slice(0, 7);
        return {
          id: currentMonth,
          month: new Date(`${currentMonth}-01`).toLocaleDateString('en-US', { month: 'long' }),
          year: parseInt(currentMonth.split('-')[0]),
          grossSalary: 0,
          netSalary: 0,
          baseSalary: responseData.baseSalary || 0,
          perDayRate: responseData.perDayRate || 0,
          status: SalaryStatus.PAID, // Default status
          paymentDate: undefined,
        };
      }
      
      return null;
    }
    
    if (!responseData.data) {
      return null;
    }
    
    const data = responseData.data;
    
    // Transform backend response to frontend SalaryRecord format
    // Use nullish coalescing (??) instead of || to preserve 0 values
    const salaryRecord = {
      id: `${data.month ?? month ?? new Date().toISOString().slice(0, 7)}`,
      month: data.month 
        ? new Date(`${data.month}-01`).toLocaleDateString('en-US', { month: 'long' })
        : month 
        ? new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long' })
        : new Date().toLocaleDateString('en-US', { month: 'long' }),
      year: parseInt((data.month ?? month ?? new Date().toISOString().slice(0, 7)).split('-')[0]),
      grossSalary: typeof data.grossSalary === 'number' ? data.grossSalary : (typeof data.baseSalary === 'number' ? data.baseSalary : 0),
      netSalary: typeof data.netSalary === 'number' ? data.netSalary : 0,
      baseSalary: typeof data.baseSalary === 'number' ? data.baseSalary : (typeof data.grossSalary === 'number' ? data.grossSalary : 0),
      perDayRate: typeof data.perDayRate === 'number' ? data.perDayRate : 0, // Per day rate from EmployeeDetails
      status: data.isHeld ? SalaryStatus.HOLD : SalaryStatus.PAID,
      paymentDate: data.paymentDate,
    };
    
    return salaryRecord;
  } catch (error) {
    console.error('[getCurrentSalary] Error:', error);
    throw error;
  }
};

/**
 * Get salary history
 */
export const getSalaryHistory = async (): Promise<SalaryRecord[]> => {
  const data = await apiRequest<any[]>('/employee/salary/history');
  
  // Transform backend response to frontend SalaryRecord[] format
  return data.map((item: any) => ({
    id: item.month || item.id || '',
    month: item.month || new Date().toLocaleDateString('en-US', { month: 'long' }),
    year: parseInt((item.month || new Date().toISOString().slice(0, 7)).split('-')[0]),
    grossSalary: item.grossSalary || item.baseSalary || 0,
    netSalary: item.netSalary || 0,
    baseSalary: item.baseSalary || item.grossSalary || 0,
    perDayRate: item.perDayRate || 0,
    status: item.isHeld ? SalaryStatus.HOLD : SalaryStatus.PAID,
    paymentDate: item.paymentDate,
  }));
};

/**
 * Download salary PDF
 * Handles PDF download, HOLD status, and NOT_GENERATED status
 */
export const downloadPayslip = async (month: string): Promise<void> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/employee/salary/pdf?month=${month}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }

  // Check if response is JSON (error response)
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    const errorData = await response.json();
    
    if (errorData.status === 'HOLD') {
      throw new Error(`Salary is on HOLD. ${errorData.holdReason ? `Reason: ${errorData.holdReason}` : 'Please contact HR.'}`);
    }
    
    if (errorData.status === 'NOT_GENERATED' || errorData.status === 'NOT_FINALIZED') {
      throw new Error('Salary not finalized yet. Please contact HR.');
    }
    
    throw new Error(errorData.message || 'Failed to download payslip');
  }

  // Response is PDF
  if (!response.ok) {
    throw new Error('Failed to download payslip');
  }

  // Get filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = contentDisposition
    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `payslip-${month}.pdf`
    : `payslip-${month}.pdf`;

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * Get attendance data for a month
 */
export const getAttendanceData = async (month?: string): Promise<{ summary: any; dailyBreakdown: AttendanceRecord[] }> => {
  const monthParam = month ? `?month=${month}` : '';
  const data = await apiRequest<any>(`/employee/attendance${monthParam}`);
  
  // Transform backend response to frontend format
  if (data.dailyBreakdown && Array.isArray(data.dailyBreakdown)) {
    const dailyBreakdown = data.dailyBreakdown.map((day: any) => {
      // Pass raw ISO strings (same as admin portal) - format in component
      return {
        date: day.date,
        status: mapAttendanceStatus(day.status),
        shift: day.shift || day.shiftName || 'Day Shift',
        firstEntry: day.firstEntry || null, // Raw ISO string from backend
        lastExit: day.lastExit || null, // Raw ISO string from backend
        totalHours: day.totalHours || 0,
        isLate: day.isLate || false,
        minutesLate: day.minutesLate || null,
        isEarlyExit: day.isEarlyExit || false,
        logCount: day.logCount || 0,
        // Include PL, CL, and Regularization data from backend
        isPaidLeave: day.isPaidLeave || false,
        isCasualLeave: day.isCasualLeave || false,
        isRegularized: day.isRegularized || false,
        regularizationValue: day.regularizationValue || undefined,
        regularizationOriginalStatus: day.regularizationOriginalStatus || undefined,
      };
    });
    
    return {
      summary: data.summary || {
        fullDays: 0,
        halfDays: 0,
        absentDays: 0,
        lateDays: 0,
        earlyExits: 0,
        totalWorkedHours: 0,
      },
      dailyBreakdown: dailyBreakdown,
    };
  }
  
  return {
    summary: {
      fullDays: 0,
      halfDays: 0,
      absentDays: 0,
      lateDays: 0,
      earlyExits: 0,
      totalWorkedHours: 0,
    },
    dailyBreakdown: [],
  };
};

/**
 * Map backend attendance status to frontend enum
 */
const mapAttendanceStatus = (status: string): AttendanceStatus => {
  switch (status?.toLowerCase()) {
    case 'present':
    case 'full-day':
      return AttendanceStatus.PRESENT;
    case 'absent':
      return AttendanceStatus.ABSENT;
    case 'half-day':
      return AttendanceStatus.HALF;
    case 'leave':
    case 'paid-leave':
    case 'casual-leave':
      return AttendanceStatus.LEAVE;
    case 'weekoff':
      return AttendanceStatus.WEEK_OFF;
    case 'not-active':
      // Not-active days are treated as absent for display
      return AttendanceStatus.ABSENT;
    default:
      return AttendanceStatus.ABSENT;
  }
};

/**
 * Format time string (using same approach as admin portal)
 */
const formatTime = (timeStr: string): string => {
  try {
    // Use parseISO for proper ISO string parsing (same as admin portal)
    // If parseISO is not available, fallback to Date constructor
    let date: Date;
    if (typeof timeStr === 'string' && timeStr.includes('T')) {
      // ISO string format: parse manually or use Date
      date = new Date(timeStr);
    } else if (typeof timeStr === 'string') {
      // Try to parse as ISO date
      date = new Date(timeStr);
    } else {
      date = timeStr as Date;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '—';
    }
    
    // Format as HH:mm (24-hour format like admin portal)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
};
