import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ApiResponse,
  Employee,
  AttendanceLog,
  AttendanceSummary,
  SalaryCalculation,
} from '@/types';

// Dynamically determine API base URL based on current host
// This allows the app to work on both localhost and LAN IP addresses
const getApiBaseUrl = (): string => {
  // Always detect from current window location first
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // If accessing via LAN IP (not localhost), always use dynamic detection
    // This ensures LAN devices work even if VITE_API_BASE_URL is set to localhost
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const apiUrl = `${protocol}//${hostname}:3000/api`;
      console.log('[API] LAN access detected, using dynamic URL:', apiUrl, 'from hostname:', hostname);
      return apiUrl;
    }
    
    // For localhost, check if env var is set and not pointing to localhost
    if (import.meta.env.VITE_API_BASE_URL) {
      const envUrl = import.meta.env.VITE_API_BASE_URL;
      // Only use env var if it's not localhost (allows override for different backend)
      if (!envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        console.log('[API] Using VITE_API_BASE_URL:', envUrl);
        return envUrl;
      }
    }
    
    // For localhost, use localhost API
    const apiUrl = `${protocol}//${hostname}:3000/api`;
    console.log('[API] Localhost access, using:', apiUrl);
    return apiUrl;
  }
  
  // Fallback for SSR or when window is not available
  // Check env var first, then default to localhost
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  console.warn('[API] Window not available, using localhost fallback');
  return 'http://localhost:3000/api';
};

const API_KEY = import.meta.env.VITE_API_KEY || 'your-api-key';

// Create axios instance - baseURL will be set dynamically in interceptor
const apiClient: AxiosInstance = axios.create({
  baseURL: '', // Will be set dynamically
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
  timeout: 30000,
});

// Request interceptor - dynamically set baseURL on each request
apiClient.interceptors.request.use(
  (config) => {
    // Always get the current API URL based on current hostname
    const currentApiUrl = getApiBaseUrl();
    config.baseURL = currentApiUrl;
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url} (baseURL: ${currentApiUrl})`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Methods
export const api = {
  // Employee APIs
  employees: {
    getAll: () => 
      apiClient.get<ApiResponse<Employee[]>>('/employees'),
    
    getByCode: (employeeNo: string) =>
      apiClient.get<ApiResponse<Employee>>(`/employees/${employeeNo}`),
    
    search: (name: string) =>
      apiClient.get<ApiResponse<Employee[]>>(`/employees/search?name=${name}`),
    
    getByDepartment: (department: string) =>
      apiClient.get<ApiResponse<Employee[]>>(`/employees/department/${department}`),
    
    reload: () =>
      apiClient.post<ApiResponse<void>>('/employees/reload'),
  },

  // Employee Details APIs (Database-driven)
  employeeDetails: {
    getAll: () =>
      apiClient.get<ApiResponse<Employee[]>>('/employee-details'),
    
    getByCode: (employeeCode: string) =>
      apiClient.get<ApiResponse<Employee>>(`/employee-details/${employeeCode}`),
    
    getByDepartment: (department: string) =>
      apiClient.get<ApiResponse<Employee[]>>(`/employee-details/department/${department}`),
    
    create: (data: any) =>
      apiClient.post<ApiResponse<any>>('/employee-details', data),
    
    update: (employeeCode: string, data: any) =>
      apiClient.put<ApiResponse<any>>(`/employee-details/${employeeCode}`, data),
    
    markAsExited: (employeeCode: string, exitDate: string, updatedBy?: string) =>
      apiClient.post<ApiResponse<void>>(`/employee-details/${employeeCode}/exit`, {
        exitDate,
        updatedBy,
      }),
    
    getSalaryInfo: (employeeCode: string) =>
      apiClient.get<ApiResponse<{ baseSalary: number; hourlyRate: number }>>(`/employee-details/${employeeCode}/salary-info`),
  },

  // Attendance APIs
  attendance: {
    getLatest: (limit: number = 50) =>
      apiClient.get<ApiResponse<AttendanceLog[]>>(`/attendance/latest?limit=${limit}`),
    
    getByDate: (date: string) =>
      apiClient.get<ApiResponse<AttendanceLog[]>>(`/attendance/by-date?date=${date}`),
    
    getRawLogs: (userId: number, date: string) =>
      apiClient.get<ApiResponse<{ userId: number; date: string; logCount: number; logs: Array<{ userId: number; logDate: string; direction: string; deviceId: number; time: string }> }>>(`/attendance/logs/${userId}/${date}`),
    
    getByEmployee: (userId: number, start?: string, end?: string) => {
      let url = `/attendance/employee/${userId}`;
      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }
      return apiClient.get<ApiResponse<AttendanceLog[]>>(url);
    },
    
    getSummary: (userId: number, month: string) =>
      apiClient.get<ApiResponse<AttendanceSummary>>(`/salary/${userId}/breakdown/${month}`),
    
    getDaily: (userId: number, date: string) =>
      apiClient.get<ApiResponse<AttendanceLog[]>>(`/attendance/daily/${userId}/${date}`),
    
    // Attendance Regularization
    saveRegularization: (payload: {
      employeeCode: string;
      month: string;
      dates: Array<{ date: string; originalStatus: string; reason?: string }>;
      approvedBy: string;
      requestedBy?: string;
    }) =>
      apiClient.post<ApiResponse<any>>('/attendance/regularize', payload),
    
    getRegularization: (employeeCode: string, month: string) =>
      apiClient.get<ApiResponse<{
        employeeCode: string;
        month: string;
        regularizations: Array<{
          date: string;
          originalStatus: string;
          regularizedStatus: string;
          reason?: string;
          approvedBy: string;
          createdAt: string;
        }>;
      }>>(`/attendance/regularization/${employeeCode}?month=${month}`),
    
    deleteRegularization: (employeeCode: string, date: string) =>
      apiClient.delete<ApiResponse<void>>(`/attendance/regularization/${employeeCode}/${date}`),
  },

  // Salary APIs
  salary: {
    calculate: (userId: number, month?: string, joinDate?: string, exitDate?: string, paidLeaveDates?: Array<{ date: string; value: number }> | string[], casualLeaveDates?: Array<{ date: string; value: number }> | string[]) => {
      let url = `/salary/${userId}`;
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (joinDate) params.append('joinDate', joinDate);
      if (exitDate) params.append('exitDate', exitDate);
      
      // Extract dates from LeaveDateWithValue[] or use string[] directly (backward compatibility)
      const extractDates = (dates: Array<{ date: string; value: number }> | string[] | undefined): string[] => {
        if (!dates || dates.length === 0) return [];
        if (typeof dates[0] === 'string') {
          return dates as string[];
        }
        return (dates as Array<{ date: string; value: number }>).map(item => item.date);
      };
      
      const paidDates = extractDates(paidLeaveDates);
      const casualDates = extractDates(casualLeaveDates);
      
      if (paidDates.length > 0) {
        console.log('[API] Adding paid leave dates:', paidDates);
        paidDates.forEach(date => params.append('paidLeave', date));
      }
      if (casualDates.length > 0) {
        console.log('[API] Adding casual leave dates:', casualDates);
        casualDates.forEach(date => params.append('casualLeave', date));
      }
      
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;
      
      console.log('[API] Final salary URL:', url);
      return apiClient.get<ApiResponse<SalaryCalculation>>(url);
    },
    
    getStatus: (userId: number, month?: string) => {
      const url = month
        ? `/salary/${userId}/status?month=${month}`
        : `/salary/${userId}/status`;
      return apiClient.get<ApiResponse<{ employeeCode: string; month: string; status: number; isFinalized: boolean; exists: boolean }>>(url);
    },
    
    finalize: (userId: number, month: string) =>
      apiClient.post<ApiResponse<{ employeeCode: string; month: string; status: number; finalizedAt: string; finalizedBy: string }>>(
        `/salary/${userId}/finalize`,
        { month }
      ),
    
    finalizeAll: (month: string) =>
      apiClient.post<ApiResponse<{ month: string; updated: number; finalizedAt: string; finalizedBy: string }>>(
        '/salary/finalize-all',
        { month }
      ),
    
    getMonthlyHours: (userId: number, month?: string) => {
      const url = month
        ? `/salary/${userId}/hours?month=${month}`
        : `/salary/${userId}/hours`;
      return apiClient.get<ApiResponse<AttendanceSummary>>(url);
    },
    
    getBreakdown: (userId: number, month: string) =>
      apiClient.get<ApiResponse<AttendanceSummary>>(`/salary/${userId}/breakdown/${month}`),
    
    batchCalculate: (employeeCodes: string[], month: string) =>
      apiClient.post<ApiResponse<SalaryCalculation[]>>('/salary/batch', {
        employeeCodes,
        month,
      }),
    
    getSummary: (month?: string, chunkSize?: number) => {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (chunkSize) params.append('chunkSize', chunkSize.toString());
      const queryString = params.toString();
      return apiClient.get<ApiResponse<{
        totalEmployees: number;
        processed: number;
        failed: number;
        data: SalaryCalculation[];
        totalNetSalary: number;
        errors?: Array<{ employeeCode: string; error: string }>;
      }>>(`/salary/summary${queryString ? `?${queryString}` : ''}`);
    },
    
    getRecentAttendance: (userId: number) =>
      apiClient.get<ApiResponse<{
        userId: number;
        generatedDate: string;
        recentAttendance: Array<{ date: string; data: any }>;
      }>>(`/salary/${userId}/recent-attendance`),
    
    // Salary Adjustment APIs (for backward compatibility)
    getAdjustments: (employeeCode: string, month: string) =>
      apiClient.get<ApiResponse<{
        adjustments: Array<{
          Id: number;
          EmployeeCode: string;
          Month: string;
          Type: 'DEDUCTION' | 'ADDITION';
          Category: string;
          Amount: number;
          Description: string | null;
          CreatedBy: string | null;
          CreatedAt: string;
          UpdatedAt: string | null;
        }>;
        summary: {
          totalDeductions: number;
          totalAdditions: number;
        };
      }>>(`/salary/adjustments/${employeeCode}?month=${month}`),
    
    saveAdjustment: (payload: {
      employeeCode: string;
      month: string;
      type: 'DEDUCTION' | 'ADDITION';
      category: string;
      amount: number;
      description?: string;
      createdBy?: string;
    }) => {
      console.log('[API] Sending salary adjustment payload:', payload);
      return apiClient.post<ApiResponse<{
        operation: string;
        adjustment: any;
      }>>('/salary/adjustment', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    
    // Salary Hold APIs
    getHold: (employeeCode: string, month: string) =>
      apiClient.get<{
        success: boolean;
        data: {
          Id: number;
          EmployeeCode: string;
          Month: string;
          HoldType: 'MANUAL' | 'AUTO';
          Reason: string | null;
          IsReleased: boolean;
          CreatedAt: string;
          ReleasedAt: string | null;
          ActionBy: string | null;
        } | null;
        isHeld: boolean;
      }>(`/salary/hold/${employeeCode}?month=${month}`),
    
    createHold: (payload: {
      employeeCode: string;
      month: string;
      reason?: string;
      actionBy?: string;
    }) =>
      apiClient.post<ApiResponse<any>>('/salary/hold', payload),
    
    releaseHold: (payload: {
      employeeCode: string;
      month: string;
      actionBy?: string;
    }) =>
      apiClient.post<ApiResponse<any>>('/salary/release-hold', payload),
  },

  // Employee Shift Assignment APIs
  employeeShifts: {
    assign: (payload: {
      employeeCode: string;
      shiftName: string;
      fromDate: string;
      toDate: string;
    }) =>
      apiClient.post<ApiResponse<{
        Id: number;
        EmployeeCode: string;
        ShiftName: string;
        FromDate: string;
        ToDate: string;
        CreatedAt: string;
      }>>('/employee-shifts/assign', payload),
    
    getAssignments: (employeeCode: string, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const queryString = params.toString();
      return apiClient.get<ApiResponse<Array<{
        Id: number;
        EmployeeCode: string;
        ShiftName: string;
        FromDate: string;
        ToDate: string;
        CreatedAt: string;
      }>>>(`/employee-shifts/${employeeCode}${queryString ? `?${queryString}` : ''}`);
    },
     
    deleteAssignment: (id: number) =>
      apiClient.delete<ApiResponse<void>>(`/employee-shifts/${id}`),
    
    // Salary Adjustment APIs
    getAdjustments: (employeeCode: string, month: string) =>
      apiClient.get<ApiResponse<{
        adjustments: Array<{
          Id: number;
          EmployeeCode: string;
          Month: string;
          Type: 'DEDUCTION' | 'ADDITION';
          Category: string;
          Amount: number;
          Description: string | null;
          CreatedBy: string | null;
          CreatedAt: string;
          UpdatedAt: string | null;
        }>;
        summary: {
          totalDeductions: number;
          totalAdditions: number;
        };
      }>>(`/salary/adjustments/${employeeCode}?month=${month}`),
    
    saveAdjustment: (payload: {
      employeeCode: string;
      month: string;
      type: 'DEDUCTION' | 'ADDITION';
      category: string;
      amount: number;
      description?: string;
      createdBy?: string;
    }) => {
      console.log('[API] Sending salary adjustment payload:', payload);
      return apiClient.post<ApiResponse<{
        operation: string;
        adjustment: any;
      }>>('/salary/adjustment', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
  },

  // Leave Management APIs
  leave: {
    // Save or update monthly leave approvals (persists across sessions)
    approve: (employeeCode: string, month: string, paidLeaveDates: Array<{ date: string; value: number }>, casualLeaveDates: Array<{ date: string; value: number }>, approvedBy?: string) =>
      apiClient.post('/leave/approve', {
        employeeCode,
        month,
        paidLeaveDates,
        casualLeaveDates,
        approvedBy,
      }),
    
    // Get leave balance for an employee
    getBalance: (employeeCode: string, year: number, month?: string) => {
      const params = new URLSearchParams({ year: year.toString() });
      if (month) params.append('month', month);
      return apiClient.get(`/leave/${employeeCode}/balance?${params.toString()}`);
    },
    
    // Get monthly leave usage (returns persisted leave approvals)
    getMonthlyUsage: (employeeCode: string, month: string) =>
      apiClient.get(`/leave/${employeeCode}/monthly/${month}`),
  },

  // Shift APIs
  shifts: {
    getAll: () =>
      apiClient.get<ApiResponse<any[]>>('/shifts'),
    
    getByName: (shiftName: string) =>
      apiClient.get<ApiResponse<any>>(`/shifts/${shiftName}`),
  },

  // Overtime APIs
  overtime: {
    getStatus: (employeeCode: string, month: string) =>
      apiClient.get<ApiResponse<{ employeeCode: string; month: string; isOvertimeEnabled: boolean }>>(`/overtime/${employeeCode}/${month}`),
    
    updateStatus: (employeeCode: string, month: string, isOvertimeEnabled: boolean) =>
      apiClient.post<ApiResponse<{ employeeCode: string; month: string; isOvertimeEnabled: boolean; operation: string }>>(`/overtime/${employeeCode}/${month}`, {
        isOvertimeEnabled,
      }),
    
    getBatchStatus: (employeeCodes: string[], month: string) => {
      const codes = employeeCodes.join(',');
      return apiClient.get<ApiResponse<{ month: string; overtimeStatus: Record<string, boolean> }>>(`/overtime/batch/${month}?employeeCodes=${codes}`);
    },
  },

  // Health check
  health: () => apiClient.get('/health'),
  ping: () => apiClient.get('/ping'),

  // Generic methods for custom requests
  get: (url: string) => apiClient.get(url),
  post: (url: string, data?: any) => apiClient.post(url, data),
  put: (url: string, data?: any) => apiClient.put(url, data),
  delete: (url: string) => apiClient.delete(url),
};

export default apiClient;

