import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserSearch, Calendar, X, Download, Loader2 } from 'lucide-react';
import Card from '@/components/UI/Card';
import SearchableSelect from '@/components/UI/SearchableSelect';
import Input from '@/components/UI/Input';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonth } from '@/utils/format';
import type { Employee, SalaryCalculation, AttendanceSummary, LeaveDateWithValue } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

export default function Salary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salary, setSalary] = useState<SalaryCalculation | null>(null);
  const [batchSalaries, setBatchSalaries] = useState<SalaryCalculation[]>([]);
  const [joinDate, setJoinDate] = useState<string>('');
  const [exitDate, setExitDate] = useState<string>('');
  const [isNewJoiner, setIsNewJoiner] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [paidLeaveDates, setPaidLeaveDates] = useState<LeaveDateWithValue[]>([]);
  const [casualLeaveDates, setCasualLeaveDates] = useState<LeaveDateWithValue[]>([]);
  const [showPaidLeaveModal, setShowPaidLeaveModal] = useState(false);
  const [showCasualLeaveModal, setShowCasualLeaveModal] = useState(false);
  const [attendanceBreakdown, setAttendanceBreakdown] = useState<AttendanceSummary | null>(null);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const [leaveLoadedFromDB, setLeaveLoadedFromDB] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isFinalizingAll, setIsFinalizingAll] = useState(false);
  
  // Regularization state
  const [regularizedDates, setRegularizedDates] = useState<Array<{ date: string; value: number }>>([]);
  const [showRegularizationModal, setShowRegularizationModal] = useState(false);
  const [regularizationReason, setRegularizationReason] = useState<string>('');
  const [isSavingRegularization, setIsSavingRegularization] = useState(false);
  const [regularizationLoadedFromDB, setRegularizationLoadedFromDB] = useState(false);
  
  // Overtime state
  const [isOvertimeEnabled, setIsOvertimeEnabled] = useState(false);
  const [isSavingOvertime, setIsSavingOvertime] = useState(false);
  const [overtimeLoadedFromDB, setOvertimeLoadedFromDB] = useState(false);
  
  // Salary adjustment state
  const [tShirtDeduction, setTShirtDeduction] = useState<number>(0);
  const [reimbursementAmount, setReimbursementAmount] = useState<number>(0);
  const [reimbursementReason, setReimbursementReason] = useState<string>('');
  const [incentiveAmount, setIncentiveAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [adjustmentsLoadedFromDB, setAdjustmentsLoadedFromDB] = useState(false);
  
  // Salary hold state
  const [salaryHold, setSalaryHold] = useState<{
    Id: number;
    EmployeeCode: string;
    Month: string;
    HoldType: 'MANUAL' | 'AUTO';
    Reason: string | null;
    IsReleased: boolean;
    CreatedAt: string;
    ReleasedAt: string | null;
    ActionBy: string | null;
    isHeld: boolean;
  } | null>(null);
  const [isLoadingHold, setIsLoadingHold] = useState(false);
  const [isSavingHold, setIsSavingHold] = useState(false);
  const [holdReason, setHoldReason] = useState<string>('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{ current: number; total: number } | null>(null);
  
  const selectedEmployee = searchParams.get('employee') || '';
  const selectedMonth = searchParams.get('month') || getCurrentMonth();

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Load persisted leave approvals and regularizations when employee/month changes
  // Note: If tables don't exist yet, this gracefully falls back to empty arrays
  useEffect(() => {
    if (selectedEmployee && selectedMonth) {
      // Reset leave dates before loading new ones to prevent stale data
      setPaidLeaveDates([]);
      setCasualLeaveDates([]);
      setLeaveLoadedFromDB(false);
      setRegularizedDates([]);
      setRegularizationLoadedFromDB(false);
      setIsOvertimeEnabled(false);
      setOvertimeLoadedFromDB(false);
      setTShirtDeduction(0);
      setReimbursementAmount(0);
      setReimbursementReason('');
      setIncentiveAmount(0);
      setAdjustmentsLoadedFromDB(false);
      
      // Load all persisted data first, then fetch salary/attendance
      const loadAllData = async () => {
        await Promise.all([
          loadPersistedLeaveApprovals(),
          loadPersistedRegularizations(),
          loadOvertimeStatus(),
          loadSalaryAdjustments(),
          loadEmployeeDetails(),
          loadSalaryHold()
        ]);
        
        // Small delay to ensure React state is updated after loading
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Only fetch salary/attendance AFTER all persisted data is loaded
        // This ensures we use the latest data from database, not stale cached data
        if (selectedEmployee && selectedMonth) {
          console.log('[Salary] All persisted data loaded, now fetching salary and attendance');
          // Use a small timeout to ensure state updates are reflected
          setTimeout(() => {
            if (selectedEmployee && selectedMonth) {
              fetchAttendanceBreakdown();
              fetchSalary();
            }
          }, 200);
        }
      };
      
      loadAllData();
    } else {
      // Clear leave data when no employee/month selected
      setPaidLeaveDates([]);
      setCasualLeaveDates([]);
      setLeaveLoadedFromDB(false);
      setRegularizedDates([]);
      setRegularizationLoadedFromDB(false);
      setIsOvertimeEnabled(false);
      setOvertimeLoadedFromDB(false);
      setTShirtDeduction(0);
      setReimbursementAmount(0);
      setReimbursementReason('');
      setIncentiveAmount(0);
      setAdjustmentsLoadedFromDB(false);
      setSalaryHold(null);
      setHoldReason('');
      setIsFinalized(false); // Reset finalized status when employee/month changes
      // Clear employee details
      setIsNewJoiner(false);
      setIsExited(false);
      setJoinDate('');
      setExitDate('');
    }
  }, [selectedEmployee, selectedMonth]);

  // Re-fetch salary when join/exit dates or custom end date changes
  // This runs AFTER the initial load is complete
  useEffect(() => {
    if (selectedEmployee && leaveLoadedFromDB && regularizationLoadedFromDB) {
      // Only refetch if we have loaded the persisted data
      // This prevents race conditions
      console.log('[Salary] Join/exit date or custom end date changed, refetching salary');
      fetchAttendanceBreakdown();
      fetchSalary();
    }
  }, [joinDate, exitDate, isNewJoiner, isExited, customEndDate]);

  // Auto-save leave approvals when they change (debounced)
  // Only save if user has actually made changes (not on initial load)
  useEffect(() => {
    if (selectedEmployee && leaveLoadedFromDB && attendanceBreakdown) {
      // Only auto-save if there are actually leave dates to save
      // This prevents unnecessary API calls on initial load
      if (paidLeaveDates.length > 0 || casualLeaveDates.length > 0) {
        console.log('[Salary] Leave dates changed, auto-saving:', { paidLeaveDates, casualLeaveDates });
        const timer = setTimeout(() => {
          saveLeaveApprovals();
        }, 1000); // Debounce 1 second
        
        return () => clearTimeout(timer);
      }
    }
  }, [paidLeaveDates, casualLeaveDates]);

  // Note: Regularizations are saved manually when "Done" button is clicked
  // No auto-save for regularizations (unlike leave approvals)

  // Recalculate salary when leave dates change (auto-save)
  // Note: Regularizations are recalculated manually after saving (on Done button click)
  // IMPORTANT: Only recalculate if data was loaded from DB first (prevents race conditions)
  useEffect(() => {
    if (selectedEmployee && leaveLoadedFromDB && regularizationLoadedFromDB) {
      // Debounce to avoid too many recalculations
      const timer = setTimeout(() => {
        console.log('[Salary] Leave dates changed, recalculating salary');
        fetchAttendanceBreakdown();
        fetchSalary();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [paidLeaveDates, casualLeaveDates]);

  // Note: Auto-save removed - using submit buttons instead

  const fetchEmployees = async () => {
    try {
      const response = await api.employees.getAll();
      const employeeList = response.data.data || [];
      setEmployees(employeeList);
    } catch (err: any) {
      setError('Failed to load employees');
    }
  };

  const fetchAttendanceBreakdown = async () => {
    if (!selectedEmployee) {
      setAttendanceBreakdown(null);
      return;
    }
    
    try {
      const response = await api.attendance.getSummary(parseInt(selectedEmployee), selectedMonth);
      const breakdown = response.data.data || null;
      
      // Only update if we're still on the same employee/month
      // This prevents race conditions when switching employees quickly
      if (selectedEmployee && selectedMonth) {
        setAttendanceBreakdown(breakdown);
      }
    } catch (err: any) {
      console.error('Failed to fetch attendance breakdown:', err);
      // Only clear if we're still on the same employee
      if (selectedEmployee) {
        setAttendanceBreakdown(null);
      }
    }
  };

  const fetchSalary = async () => {
    if (!selectedEmployee) {
      setSalary(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[Salary] Fetching salary with leave dates:', {
        employee: selectedEmployee,
        month: selectedMonth,
        paidLeave: paidLeaveDates,
        casualLeave: casualLeaveDates,
      });
      
      // Use customEndDate if provided, otherwise use exitDate if employee is exited
      const effectiveExitDate = customEndDate || (isExited ? exitDate : undefined);
      
      // Always pass leave dates arrays (even if empty) to prevent backend from fetching stale data from DB
      // If arrays are empty, backend will use empty arrays instead of fetching from database
      const response = await api.salary.calculate(
        parseInt(selectedEmployee), 
        selectedMonth,
        isNewJoiner ? joinDate : undefined,
        effectiveExitDate,
        paidLeaveDates, // Array of { date, value } - backend will use this instead of DB
        casualLeaveDates // Array of { date, value } - backend will use this instead of DB
      );
      
      // Only update salary if we're still on the same employee/month
      // This prevents race conditions when switching employees quickly
      if (selectedEmployee === response.data.data?.employeeCode || 
          selectedEmployee === String(response.data.data?.employeeCode)) {
        setSalary(response.data.data || null);
        
        // Check if salary is finalized by calling the status API
        // This ensures we show the correct finalized status even after refresh
        try {
          const statusResponse = await api.salary.getStatus(
            parseInt(selectedEmployee),
            selectedMonth
          );
          if (statusResponse.data.success) {
            setIsFinalized(statusResponse.data.data?.isFinalized || false);
          } else {
            setIsFinalized(false);
          }
        } catch (err) {
          console.warn('[Salary] Could not check finalized status:', err);
          setIsFinalized(false);
        }
      }
    } catch (err: any) {
      // Only set error if we're still on the same employee
      if (selectedEmployee) {
        setError(err.response?.data?.message || 'Failed to load salary data');
      }
    } finally {
      // Only update loading state if we're still on the same employee
      if (selectedEmployee) {
        setLoading(false);
      }
    }
  };

  /**
   * Load persisted leave approvals from database
   * This ensures leave approvals survive page refreshes
   * If tables don't exist yet, gracefully falls back to empty state
   */
  const loadPersistedLeaveApprovals = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    try {
      console.log('[Salary] Loading persisted leave approvals from database');
      const response = await api.leave.getMonthlyUsage(selectedEmployee, selectedMonth);
      
      if (response.data.success && response.data.data) {
        const { paidLeaveDates: paid, casualLeaveDates: casual } = response.data.data;
        
        // Always set arrays, even if empty (handles case where data was deleted from DB)
        const paidArray = Array.isArray(paid) ? paid : [];
        const casualArray = Array.isArray(casual) ? casual : [];
        
        setPaidLeaveDates(paidArray);
        setCasualLeaveDates(casualArray);
        
        console.log('[Salary] Loaded leave approvals from database:', { 
          paid: paidArray.length, 
          casual: casualArray.length,
          paidDates: paidArray,
          casualDates: casualArray
        });
      } else {
        // No saved leave approvals, explicitly reset to empty
        console.log('[Salary] No leave approvals found in database, clearing state');
        setPaidLeaveDates([]);
        setCasualLeaveDates([]);
      }
      
      setLeaveLoadedFromDB(true);
    } catch (err: any) {
      console.warn('[Salary] Leave persistence not available (tables may not exist yet)');
      // If API fails (table doesn't exist), just start with empty arrays
      // This allows the app to work even without leave tables
      setPaidLeaveDates([]);
      setCasualLeaveDates([]);
      setLeaveLoadedFromDB(true);
    }
  };

  /**
   * Load persisted attendance regularizations from database
   */
  const loadPersistedRegularizations = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    try {
      console.log('[Salary] Loading persisted regularizations from database');
      const response = await api.attendance.getRegularization(selectedEmployee, selectedMonth);
      
      if (response.data.success && response.data.data) {
        const { regularizations } = response.data.data;
        // Normalize dates to YYYY-MM-DD format and extract value from regularizedStatus
        const datesWithValues = regularizations.map(r => {
          const dateStr = r.date;
          // If it's a Date object or ISO string, extract YYYY-MM-DD
          let normalizedDate = dateStr;
          if (dateStr.includes('T')) {
            normalizedDate = dateStr.split('T')[0];
          }
          // Extract value from regularizedStatus: 'half-day' = 0.5, 'full-day' = 1.0
          const value = r.regularizedStatus === 'half-day' ? 0.5 : 1.0;
          return { date: normalizedDate, value };
        });
        
        setRegularizedDates(datesWithValues);
        console.log('[Salary] Loaded regularizations from database:', datesWithValues);
      } else {
        console.log('[Salary] No regularizations found in database');
        setRegularizedDates([]);
      }
      
      setRegularizationLoadedFromDB(true);
    } catch (err: any) {
      console.warn('[Salary] Regularization persistence not available (table may not exist yet)');
      setRegularizedDates([]);
      setRegularizationLoadedFromDB(true);
    }
  };

  /**
   * Load overtime status from database
   */
  const loadOvertimeStatus = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    try {
      console.log('[Salary] Loading overtime status from database');
      const response = await api.overtime.getStatus(selectedEmployee, selectedMonth);
      
      if (response.data.success && response.data.data) {
        setIsOvertimeEnabled(response.data.data.isOvertimeEnabled);
        console.log('[Salary] Loaded overtime status from database:', response.data.data.isOvertimeEnabled);
      } else {
        console.log('[Salary] No overtime status found in database, defaulting to disabled');
        setIsOvertimeEnabled(false);
      }
      
      setOvertimeLoadedFromDB(true);
    } catch (err: any) {
      console.warn('[Salary] Overtime persistence not available (table may not exist yet)');
      setIsOvertimeEnabled(false);
      setOvertimeLoadedFromDB(true);
    }
  };

  /**
   * Save overtime toggle to database
   */
  const saveOvertimeStatus = async (enabled: boolean) => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setIsSavingOvertime(true);
    try {
      console.log('[Salary] Saving overtime status:', enabled);
      const response = await api.overtime.updateStatus(selectedEmployee, selectedMonth, enabled);
      
      if (response.data.success) {
        setIsOvertimeEnabled(enabled);
        console.log('[Salary] Overtime status saved successfully');
        // Recalculate salary to reflect overtime changes
        await fetchSalary();
      } else {
        throw new Error(response.data.message || 'Failed to save overtime status');
      }
    } catch (err: any) {
      console.error('[Salary] Error saving overtime status:', err);
      alert(`Failed to save overtime status: ${err.message}`);
    } finally {
      setIsSavingOvertime(false);
    }
  };

  /**
   * Load salary adjustments from database
   */
  const loadSalaryAdjustments = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    try {
      console.log('[Salary] Loading salary adjustments from database');
      const response = await api.salary.getAdjustments(selectedEmployee, selectedMonth);
      
      if (response.data.success && response.data.data) {
        const { adjustments } = response.data.data;
        
        // Find T-Shirt deduction
        const tShirtAdj = adjustments.find(
          (adj: any) => adj.Type === 'DEDUCTION' && adj.Category === 'T_SHIRT'
        );
        setTShirtDeduction(tShirtAdj ? tShirtAdj.Amount : 0);
        
        // Find Reimbursement addition
        const reimbursementAdj = adjustments.find(
          (adj: any) => adj.Type === 'ADDITION' && adj.Category === 'REIMBURSEMENT'
        );
        setReimbursementAmount(reimbursementAdj ? reimbursementAdj.Amount : 0);
        setReimbursementReason(reimbursementAdj?.Description || '');
        
        // Find Incentive addition
        const incentiveAdj = adjustments.find(
          (adj: any) => adj.Type === 'ADDITION' && adj.Category === 'INCENTIVE'
        );
        setIncentiveAmount(incentiveAdj ? incentiveAdj.Amount : 0);
        
        // Find Advance deduction
        const advanceAdj = adjustments.find(
          (adj: any) => adj.Type === 'DEDUCTION' && adj.Category === 'ADVANCE'
        );
        setAdvanceAmount(advanceAdj ? advanceAdj.Amount : 0);
        
        console.log('[Salary] Loaded salary adjustments from database:', {
          tShirtDeduction: tShirtAdj?.Amount || 0,
          reimbursementAmount: reimbursementAdj?.Amount || 0,
          incentiveAmount: incentiveAdj?.Amount || 0,
          advanceAmount: advanceAdj?.Amount || 0,
        });
      } else {
        console.log('[Salary] No salary adjustments found in database');
        setTShirtDeduction(0);
        setReimbursementAmount(0);
        setReimbursementReason('');
        setIncentiveAmount(0);
        setAdvanceAmount(0);
      }
      
      setAdjustmentsLoadedFromDB(true);
    } catch (err: any) {
      console.warn('[Salary] Salary adjustments persistence not available (table may not exist yet)');
      setTShirtDeduction(0);
      setReimbursementAmount(0);
      setReimbursementReason('');
      setIncentiveAmount(0);
      setAdvanceAmount(0);
      setAdjustmentsLoadedFromDB(true);
    }
  };

  /**
   * Load salary hold status from database
   */
  const loadSalaryHold = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    try {
      setIsLoadingHold(true);
      console.log('[Salary] Loading salary hold status from database');
      const response = await api.salary.getHold(selectedEmployee, selectedMonth);
      
      if (response.data.success) {
        if (response.data.data) {
          // Merge isHeld property into the hold object
          // isHeld is returned at response.data level
          const holdData = {
            ...response.data.data,
            isHeld: response.data.isHeld,
          };
          setSalaryHold(holdData);
          console.log('[Salary] Loaded salary hold status:', holdData, 'isHeld:', holdData.isHeld);
        } else {
          setSalaryHold(null);
          console.log('[Salary] No salary hold found');
        }
      } else {
        setSalaryHold(null);
        console.log('[Salary] No salary hold found');
      }
    } catch (err: any) {
      console.warn('[Salary] Could not load salary hold status:', err.response?.data?.message || err.message);
      setSalaryHold(null);
    } finally {
      setIsLoadingHold(false);
    }
  };

  /**
   * Create a manual salary hold
   */
  const createSalaryHold = async (): Promise<boolean> => {
    if (!selectedEmployee || !selectedMonth) {
      alert('Please select an employee and month first');
      return false;
    }
    
    setIsSavingHold(true);
    try {
      const response = await api.salary.createHold({
        employeeCode: selectedEmployee,
        month: selectedMonth,
        reason: holdReason.trim() || undefined, // Send undefined to omit field if empty (axios will omit it)
        actionBy: 'Admin', // You can replace this with actual admin user
      });
      
      if (response.data.success) {
        setHoldReason('');
        console.log('[Salary] Salary hold created successfully');
        // Reload hold status to get complete data with isHeld flag
        await loadSalaryHold();
        // Refresh salary to reflect hold status
        await fetchSalary();
        return true;
      } else {
        alert('Failed to create salary hold');
        return false;
      }
    } catch (err: any) {
      console.error('[Salary] Error creating salary hold:', err);
      alert(err.response?.data?.message || 'Failed to create salary hold');
      return false;
    } finally {
      setIsSavingHold(false);
    }
  };

  /**
   * Release a salary hold
   */
  const releaseSalaryHold = async (): Promise<boolean> => {
    if (!selectedEmployee || !selectedMonth) {
      alert('Please select an employee and month first');
      return false;
    }
    
    if (!salaryHold || salaryHold.IsReleased) {
      alert('No active salary hold found');
      return false;
    }
    
    setIsSavingHold(true);
    try {
      const response = await api.salary.releaseHold({
        employeeCode: selectedEmployee,
        month: selectedMonth,
        actionBy: 'Admin', // You can replace this with actual admin user
      });
      
      if (response.data.success) {
        console.log('[Salary] Salary hold released successfully');
        // Reload hold status to get updated data
        await loadSalaryHold();
        // Refresh salary to reflect release
        await fetchSalary();
        return true;
      } else {
        alert('Failed to release salary hold');
        return false;
      }
    } catch (err: any) {
      console.error('[Salary] Error releasing salary hold:', err);
      alert(err.response?.data?.message || 'Failed to release salary hold');
      return false;
    } finally {
      setIsSavingHold(false);
    }
  };

  /**
   * Save salary adjustment to database
   */
  const saveSalaryAdjustment = async (
    type: 'DEDUCTION' | 'ADDITION',
    category: string,
    amount: number,
    description?: string
  ): Promise<boolean> => {
    // Validate required fields
    if (!selectedEmployee || selectedEmployee.trim() === '') {
      alert('Please select an employee first');
      return false;
    }
    
    if (!selectedMonth || selectedMonth.trim() === '') {
      alert('Please select a month first');
      return false;
    }
    
    if (!type || (type !== 'DEDUCTION' && type !== 'ADDITION')) {
      alert('Invalid adjustment type');
      return false;
    }
    
    if (!category || category.trim() === '') {
      alert('Category is required');
      return false;
    }
    
    if (amount === undefined || amount === null || isNaN(amount)) {
      alert('Please enter a valid amount');
      return false;
    }
    
    if (amount < 0) {
      alert('Amount cannot be negative');
      return false;
    }
    
    setIsSavingAdjustment(true);
    try {
      // Ensure all values are properly formatted
      const payload = {
        employeeCode: String(selectedEmployee).trim(),
        month: String(selectedMonth).trim(),
        type: type as 'DEDUCTION' | 'ADDITION',
        category: String(category).trim(),
        amount: parseFloat(Number(amount).toFixed(2)),
        description: description ? String(description).trim() : undefined,
        createdBy: 'admin',
      };
      
      console.log('[Salary] Saving salary adjustment with payload:', payload);
      
      const response = await api.salary.saveAdjustment(payload);
      
      if (response.data.success) {
        console.log('[Salary] ✅ Salary adjustment saved successfully');
        // Recalculate salary to reflect adjustment changes
        await fetchSalary();
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to save salary adjustment');
      }
    } catch (err: any) {
      console.error('[Salary] Error saving salary adjustment:', err);
      console.error('[Salary] Error details:', {
        response: err.response?.data,
        status: err.response?.status,
        message: err.message,
      });
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save adjustment';
      alert(`Error: ${errorMessage}`);
      return false;
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  /**
   * Handle T-Shirt Deduction submit
   */
  const handleTShirtSubmit = async () => {
    if (tShirtDeduction <= 0) {
      alert('Please enter a valid T-Shirt deduction amount');
      return;
    }
    
    const success = await saveSalaryAdjustment('DEDUCTION', 'T_SHIRT', tShirtDeduction);
    if (success) {
      // Optionally show success message
      console.log('[Salary] T-Shirt deduction saved and salary recalculated');
    }
  };

  /**
   * Handle Reimbursement submit
   */
  const handleReimbursementSubmit = async () => {
    if (reimbursementAmount <= 0) {
      alert('Please enter a valid reimbursement amount');
      return;
    }
    
    const success = await saveSalaryAdjustment(
      'ADDITION', 
      'REIMBURSEMENT', 
      reimbursementAmount, 
      reimbursementReason || undefined
    );
    if (success) {
      // Optionally show success message
      console.log('[Salary] Reimbursement saved and salary recalculated');
    }
  };

  /**
   * Handle Incentive submit
   */
  const handleIncentiveSubmit = async () => {
    if (incentiveAmount <= 0) {
      alert('Please enter a valid incentive amount');
      return;
    }
    
    const success = await saveSalaryAdjustment(
      'ADDITION', 
      'INCENTIVE', 
      incentiveAmount
    );
    if (success) {
      // Optionally show success message
      console.log('[Salary] Incentive saved and salary recalculated');
    }
  };

  /**
   * Handle Advance submit
   */
  const handleAdvanceSubmit = async () => {
    if (advanceAmount <= 0) {
      alert('Please enter a valid advance amount');
      return;
    }
    
    const success = await saveSalaryAdjustment(
      'DEDUCTION', 
      'ADVANCE', 
      advanceAmount
    );
    if (success) {
      // Optionally show success message
      console.log('[Salary] Advance deduction saved and salary recalculated');
    }
  };

  /**
   * Save attendance regularizations to database
   */
  const saveRegularizations = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setIsSavingRegularization(true);
    
    try {
      console.log('[Salary] Saving regularizations to database');
      
      // Build payload with original status from attendance breakdown and value
      const dates = regularizedDates.map(reg => {
        const dayEntry = attendanceBreakdown?.dailyBreakdown.find(d => d.date === reg.date);
        return {
          date: reg.date,
          originalStatus: dayEntry?.status || 'absent',
          regularizedStatus: reg.value === 0.5 ? 'half-day' : 'full-day',
          reason: regularizationReason || undefined
        };
      });
      
      await api.attendance.saveRegularization({
        employeeCode: selectedEmployee,
        month: selectedMonth,
        dates,
        approvedBy: 'admin',
        requestedBy: 'admin'
      });
      
      console.log('[Salary] ✅ Regularizations saved successfully');
    } catch (err: any) {
      console.warn('[Salary] Could not save regularizations:', err.response?.data?.message || err.message);
    } finally {
      setIsSavingRegularization(false);
    }
  };

  /**
   * Save leave approvals to database
   * This persists them across sessions
   * If leave tables don't exist yet, gracefully continues without persistence
   */
  const saveLeaveApprovals = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setIsSavingLeave(true);
    
    try {
      console.log('[Salary] Saving leave approvals to database');
      await api.leave.approve(
        selectedEmployee,
        selectedMonth,
        paidLeaveDates,
        casualLeaveDates,
        'admin' // You can replace this with actual admin username
      );
      console.log('[Salary] ✅ Leave approvals saved successfully');
    } catch (err: any) {
      // Don't show error to user if table doesn't exist yet
      // This allows the app to work even without leave persistence tables
      console.warn('[Salary] Could not save leave approvals (leave tables may not exist yet):', err.response?.data?.message || err.message);
      // Don't set error state - let the app continue working
    } finally {
      setIsSavingLeave(false);
    }
  };

  /**
   * Get salary cycle range (26th of previous month to 25th of selected month)
   * Example: November 2025 = Oct 26, 2025 to Nov 25, 2025
   */
  const getSalaryCycleRange = (month: string): { start: string; end: string } => {
    const [year, monthNum] = month.split('-').map(Number);
    
    // Salary cycle: 26th of previous month to 25th of current month
    const startDate = new Date(year, monthNum - 2, 26); // Previous month, 26th
    const endDate = new Date(year, monthNum - 1, 25);   // Current month, 25th
    
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return {
      start: formatDate(startDate),
      end: formatDate(endDate),
    };
  };

  /**
   * Check if a date falls within the current salary cycle
   */
  const isDateInSalaryCycle = (dateStr: string, month: string): boolean => {
    const cycle = getSalaryCycleRange(month);
    return dateStr >= cycle.start && dateStr <= cycle.end;
  };

  /**
   * Load employee details (joining date, exit date) from backend
   * This ensures the toggles and dates persist across sessions
   * Enables "New Joining" toggle if joining date falls within the salary cycle
   */
  const loadEmployeeDetails = async () => {
    if (!selectedEmployee) return;
    
    try {
      console.log('[Salary] Loading employee details from backend');
      const response = await api.employeeDetails.getByCode(selectedEmployee);
      
      if (response.data.success && response.data.data) {
        const employee = response.data.data;
        const joiningDate = employee.joiningDate;
        const exitDate = employee.exitDate;
        
        // Set joining date and toggle if joining date exists AND falls within salary cycle
        if (joiningDate) {
          // Convert date from YYYY-MM-DD to format expected by date input (YYYY-MM-DD)
          const formattedJoinDate = joiningDate.split('T')[0]; // Handle ISO date strings
          
          // Check if joining date falls within the current salary cycle
          // Salary cycle: 26th of previous month to 25th of selected month
          if (isDateInSalaryCycle(formattedJoinDate, selectedMonth)) {
            setJoinDate(formattedJoinDate);
            setIsNewJoiner(true);
            console.log('[Salary] Loaded joining date (within salary cycle):', formattedJoinDate);
          } else {
            // Joining date is outside the salary cycle - don't enable toggle
            setJoinDate('');
            setIsNewJoiner(false);
            const cycle = getSalaryCycleRange(selectedMonth);
            console.log('[Salary] Joining date is outside salary cycle. Joining:', formattedJoinDate, 'Cycle:', cycle.start, 'to', cycle.end);
          }
        } else {
          setJoinDate('');
          setIsNewJoiner(false);
        }
        
        // Set exit date and toggle if exit date exists
        if (exitDate) {
          // Convert date from YYYY-MM-DD to format expected by date input (YYYY-MM-DD)
          const formattedExitDate = exitDate.split('T')[0]; // Handle ISO date strings
          setExitDate(formattedExitDate);
          setIsExited(true);
          console.log('[Salary] Loaded exit date:', formattedExitDate);
        } else {
          setExitDate('');
          setIsExited(false);
        }
      } else {
        // No employee details found, reset to defaults
        console.log('[Salary] No employee details found, clearing state');
        setJoinDate('');
        setExitDate('');
        setIsNewJoiner(false);
        setIsExited(false);
      }
    } catch (err: any) {
      console.warn('[Salary] Could not load employee details:', err.response?.data?.message || err.message);
      // If API fails, reset to defaults
      setJoinDate('');
      setExitDate('');
      setIsNewJoiner(false);
      setIsExited(false);
    }
  };

  const handleEmployeeChange = (employeeNo: string) => {
    // Reset all state when changing employee
    setSearchParams({ employee: employeeNo, month: selectedMonth });
    setLeaveLoadedFromDB(false);
    setPaidLeaveDates([]);
    setCasualLeaveDates([]);
    setAttendanceBreakdown(null);
    setSalary(null);
    setJoinDate('');
    setExitDate('');
    setIsNewJoiner(false);
    setIsExited(false);
    setCustomEndDate('');
    setError(null);
  };

  const handleMonthChange = (month: string) => {
    // Reset leave-related state when changing month
    setSearchParams({ employee: selectedEmployee, month: month });
    setLeaveLoadedFromDB(false);
    setPaidLeaveDates([]);
    setCasualLeaveDates([]);
    setAttendanceBreakdown(null);
    setSalary(null);
    setError(null);
  };


  // Get absent dates from attendance breakdown
  // Shows both absent and half-day dates if both exist
  // Shows only absent dates if only absent days exist
  // Shows only half-day dates if only half days exist
  // Returns dates in chronological order
  const getAbsentDates = (): string[] => {
    if (!attendanceBreakdown) return [];
    
    const absentDays = attendanceBreakdown.dailyBreakdown
      .filter(day => day.status === 'absent')
      .map(day => day.date);
    
    const halfDays = attendanceBreakdown.dailyBreakdown
      .filter(day => day.status === 'half-day')
      .map(day => day.date);
    
    // Combine dates if both exist, otherwise return only what exists
    let result: string[] = [];
    if (absentDays.length > 0 && halfDays.length > 0) {
      result = [...absentDays, ...halfDays];
    } else if (absentDays.length > 0) {
      result = absentDays;
    } else if (halfDays.length > 0) {
      result = halfDays;
    }
    
    // Sort dates in chronological order (YYYY-MM-DD format sorts correctly as strings)
    return result.sort((a, b) => a.localeCompare(b));
  };

  // Get regularizable dates (absent + half-day, including already regularized)
  // Same behavior as getAbsentDates() - shows all eligible dates, not just unselected ones
  const getRegularizableDates = (): string[] => {
    if (!attendanceBreakdown) return [];
    
    const absentDays = attendanceBreakdown.dailyBreakdown
      .filter(day => day.status === 'absent')
      .map(day => day.date);
    
    const halfDays = attendanceBreakdown.dailyBreakdown
      .filter(day => day.status === 'half-day')
      .map(day => day.date);
    
    // Combine dates if both exist, otherwise return only what exists
    let result: string[] = [];
    if (absentDays.length > 0 && halfDays.length > 0) {
      result = [...absentDays, ...halfDays];
    } else if (absentDays.length > 0) {
      result = absentDays;
    } else if (halfDays.length > 0) {
      result = halfDays;
    }
    
    // Sort dates in chronological order (YYYY-MM-DD format sorts correctly as strings)
    return result.sort((a, b) => a.localeCompare(b));
  };

  // Get attendance status for a specific date
  const getDateStatus = (date: string): 'absent' | 'half-day' | null => {
    if (!attendanceBreakdown) return null;
    const dayEntry = attendanceBreakdown.dailyBreakdown.find(d => d.date === date);
    if (dayEntry && (dayEntry.status === 'absent' || dayEntry.status === 'half-day')) {
      return dayEntry.status;
    }
    return null;
  };

  const handleRegularizationToggle = (date: string, value: number = 1.0) => {
    setRegularizedDates(prev => {
      const existing = prev.find(d => d.date === date);
      if (existing) {
        return prev.filter(d => d.date !== date);
      } else {
        return [...prev, { date, value }];
      }
    });
  };

  const handleRegularizationValueChange = (date: string, value: number) => {
    setRegularizedDates(prev => {
      const existing = prev.find(d => d.date === date);
      if (existing) {
        return prev.map(d => d.date === date ? { ...d, value } : d);
      } else {
        return [...prev, { date, value }];
      }
    });
  };

  const handlePaidLeaveDateToggle = (date: string, value: number = 1.0) => {
    setPaidLeaveDates(prev => {
      const existingIndex = prev.findIndex(d => d.date === date);
      if (existingIndex >= 0) {
        // If already exists, remove it
        return prev.filter(d => d.date !== date);
      } else {
        // Remove from casual leave if it exists there
        setCasualLeaveDates(prevCasual => prevCasual.filter(d => d.date !== date));
        // Add with specified value
        return [...prev, { date, value: value === 0.5 ? 0.5 : 1.0 }];
      }
    });
  };

  const handleCasualLeaveDateToggle = (date: string, value: number = 0.5) => {
    setCasualLeaveDates(prev => {
      const existingIndex = prev.findIndex(d => d.date === date);
      if (existingIndex >= 0) {
        // If already exists, remove it
        return prev.filter(d => d.date !== date);
      } else {
        // Remove from paid leave if it exists there
        setPaidLeaveDates(prevPaid => prevPaid.filter(d => d.date !== date));
        // Add with specified value
        return [...prev, { date, value: value === 1.0 ? 1.0 : 0.5 }];
      }
    });
  };

  const handleLeaveValueChange = (date: string, type: 'paid' | 'casual', newValue: number) => {
    if (type === 'paid') {
      setPaidLeaveDates(prev => {
        const index = prev.findIndex(d => d.date === date);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { date, value: newValue === 0.5 ? 0.5 : 1.0 };
          return updated;
        }
        return prev;
      });
    } else {
      setCasualLeaveDates(prev => {
        const index = prev.findIndex(d => d.date === date);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { date, value: newValue === 1.0 ? 1.0 : 0.5 };
          return updated;
        }
        return prev;
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!salary || !selectedEmployee) return;

    // Fetch recent attendance data from the backend API
    let recentAttendanceData: Array<{date: string, data: any}> = [];
    try {
      const userId = parseInt(selectedEmployee);
      const recentResponse = await api.salary.getRecentAttendance(userId);
      recentAttendanceData = recentResponse.data?.data?.recentAttendance || [];
    } catch (err) {
      console.error('Failed to fetch recent attendance:', err);
      // Continue with PDF generation even if recent attendance fails
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Get employee name
    const employee = employees.find(emp => emp.employeeNo === selectedEmployee);
    const employeeName = employee?.name || 'Unknown';
    
    // Helper function to format currency for PDF (avoid special characters)
    const formatPdfCurrency = (amount: number): string => {
      return 'Rs. ' + amount.toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    };
    
    // Header (minimal ink - just text and border)
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
    
    // Employee Information (minimal design - two column layout - ultra compact for single page)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Information', 14, 42);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Left column
    const leftColX = 14;
    let currentY = 50;
    doc.text(`Name: ${employeeName}`, leftColX, currentY);
    currentY += 5;
    doc.text(`Employee Code: ${selectedEmployee}`, leftColX, currentY);
    currentY += 5;
    doc.text(`Department: ${employee?.department || 'N/A'}`, leftColX, currentY);
    currentY += 5;
    doc.text(`Designation: ${employee?.designation || 'N/A'}`, leftColX, currentY);
    
    // Right column
    const rightColX = 110;
    currentY = 50;
    doc.text(`Join Date: ${(employee as any)?.joinDate || 'N/A'}`, rightColX, currentY);
    currentY += 5;
    
    // Show pro-rata calculation info if New Joining toggle is ON
    if (isNewJoiner && joinDate) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 100, 0); // Dark green color
      doc.text(`Pro-Rata: From ${new Date(joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, rightColX, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      currentY += 5;
    }
    
    // Show exit date info if Contract Cessation toggle is ON
    if (isExited && exitDate) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(139, 0, 0); // Dark red color
      doc.text(`Exit Date: ${new Date(exitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, rightColX, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      currentY += 5;
    }
    
    doc.text(`Basic Salary: ${(employee as any)?.fullBasic ? formatPdfCurrency((employee as any).fullBasic) : 'N/A'}`, rightColX, currentY);
    currentY += 5;
    doc.text(`Location: ${(employee as any)?.location || 'N/A'}`, rightColX, currentY);
    currentY += 5;
    doc.text(`Month: ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`, rightColX, currentY);
    
    // Salary Summary (ultra compact for single page)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Salary Summary', 14, 75);
    
    // Build salary summary body with adjustments
    const salaryBody: string[][] = [
      ['Base Salary', formatPdfCurrency(salary.baseSalary)],
      ['Gross Salary', formatPdfCurrency(salary.grossSalary)],
    ];

    // Add adjustments if they exist (incentive is already included in gross salary)
    if (salary.breakdown.incentiveAmount && salary.breakdown.incentiveAmount > 0) {
      salaryBody.push(['Incentive', `+${formatPdfCurrency(salary.breakdown.incentiveAmount)}`]);
    }
    // Display individual adjustments from adjustmentDetails (exclude incentive as it's already shown above)
    if (salary.breakdown.adjustmentDetails && salary.breakdown.adjustmentDetails.length > 0) {
      salary.breakdown.adjustmentDetails
        .filter((adj: any) => adj.category !== 'INCENTIVE') // Exclude incentive to avoid duplication
        .forEach((adj: any) => {
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
      ['Total Deductions', `-${formatPdfCurrency(salary.breakdown.totalDeductions)}`],
      ['Net Salary', formatPdfCurrency(salary.netSalary)]
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
    
    // Attendance Summary (new format: P, 0.5 P, PL, CL, WO, LOP, TOTAL, LOP + PL + CL, PAY DAYS)
    const finalY1 = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT RUNNING CYCLE ATTENDANCE SUMMARY', 14, finalY1);
    
    // Calculate summary statistics from attendance breakdown
    // IMPORTANT: Filter days based on joining/exit dates to match salary calculation
    // But use backend-calculated values for weekoffs and pay days (they're already correct)
    let presentDays = 0;
    let halfPresentDays = 0;
    let paidLeaveDays = 0;
    let casualLeaveDays = 0;
    let lossOfPayDays = 0;
    const totalDays = salary.attendance.totalDays;
    const totalPayableDays = salary.attendance.totalPayableDays;
    
    // Use backend-calculated paid Sundays (already accounts for joining date and sandwich rule)
    const weekoffPaidDays = salary.attendance.sundaysInMonth || 0;
    
    if (attendanceBreakdown && attendanceBreakdown.dailyBreakdown) {
      attendanceBreakdown.dailyBreakdown.forEach(day => {
        // Skip days before joining date if "New Joining" toggle is ON
        if (isNewJoiner && joinDate && day.date < joinDate) {
          return; // Skip this day
        }
        
        // Skip days after exit date if "Contract Cessation" toggle is ON
        if (isExited && exitDate && day.date > exitDate) {
          return; // Skip this day
        }
        
        const paidLeaveItem = paidLeaveDates.find(d => d.date === day.date);
        if (paidLeaveItem) {
          // Paid leave - use explicit value
          paidLeaveDays += paidLeaveItem.value;
        } else {
          const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
          if (casualLeaveItem) {
            // Casual leave - use explicit value
            casualLeaveDays += casualLeaveItem.value;
          // IMPORTANT: Also count the original status (half-day or absent)
          // If original status was half-day, it should still be counted
          const originalStatus = (day as any).originalStatus || day.status;
          if (originalStatus === 'half-day') {
            halfPresentDays++; // Count the half-day that was worked
          }
          // If original was absent, it's already covered by casualLeaveDays
        } else if (day.status === 'full-day') {
          presentDays++;
        } else if (day.status === 'half-day') {
          halfPresentDays++;
        } else if (day.status === 'absent') {
          lossOfPayDays++;
        }
        // Note: weekoffs are counted separately using backend value (weekoffPaidDays)
      }});
    }
    
    // Calculate totals
    // Calculate total leave days using explicit values
    const totalPaidLeaveDays = paidLeaveDates.reduce((sum, item) => sum + item.value, 0);
    const totalCasualLeaveDays = casualLeaveDates.reduce((sum, item) => sum + item.value, 0);
    const totalLeaveAndLOP = lossOfPayDays + totalPaidLeaveDays + totalCasualLeaveDays;
    
    // Use backend-calculated totalPayableDays directly (already accounts for joining date, leaves, weekoffs)
    const payDays = salary.attendance.totalPayableDays;
    
    // Build summary body
    const summaryBody = [
      ['Present', `${presentDays}`],
      ['Half Present', `${halfPresentDays}`],
      ['Paid Leave (PL)', `${paidLeaveDays}`],
      ['Casual Leave (CL)', `${casualLeaveDays.toFixed(1)}`],
    ];
    
    // Add weekoff row(s)
    // WO should only show paid weekoffs (from backend calculation)
    summaryBody.push(['WO', `${weekoffPaidDays}`]);
    
    summaryBody.push(['LOP', `${lossOfPayDays}`]);
    summaryBody.push(['TOTAL', `${totalPayableDays}/${totalDays}`]);
    summaryBody.push(['LOP + PL + CL', `${totalLeaveAndLOP}`]);
    summaryBody.push(['PAY DAYS', `${payDays.toFixed(1)}`]);
    
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
    const perDayRate = salary.breakdown.perDayRate;
    const hourlyRate = salary.breakdown.hourlyRate;
    const fullDaysCount = salary.attendance.fullDays;
    const absentDays = salary.attendance.absentDays;
    const lateDays = salary.attendance.lateDays;
    const paidSundays = salary.attendance.sundaysInMonth;
    const overtimeHours = salary.attendance.overtimeHours || 0;
    const lopDeduction = (salary.breakdown as any).lopDeduction || 0;
    const tdsDeduction = (salary.breakdown as any).tdsDeduction || 0;
    const professionalTax = (salary.breakdown as any).professionalTax || 0;
    const halfDays = salary.attendance.halfDays;
    
    // Calculate paid leave and casual leave days from attendance breakdown
    let calcPaidLeaveDays = 0;
    let calcCasualLeaveDays = 0; // This will be in actual days (0.5 per date)
    if (attendanceBreakdown && attendanceBreakdown.dailyBreakdown) {
      attendanceBreakdown.dailyBreakdown.forEach(day => {
        const paidLeaveItem = paidLeaveDates.find(d => d.date === day.date);
        if (paidLeaveItem) {
          calcPaidLeaveDays += paidLeaveItem.value;
        } else {
          const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
          if (casualLeaveItem) {
            calcCasualLeaveDays += casualLeaveItem.value;
          }
        }
      });
    }
    
    // Build formula table body
    const breakdownBody = [];
    
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
    
    // Paid Leave Salary
    if (calcPaidLeaveDays > 0) {
      const paidLeaveSalary = calcPaidLeaveDays * perDayRate;
      breakdownBody.push([
        'Paid Leave Salary',
        `${calcPaidLeaveDays} days × ${formatPdfCurrency(perDayRate)} = ${formatPdfCurrency(paidLeaveSalary)}`
      ]);
    }
    
    // Casual Leave Salary
    // Note: calcCasualLeaveDays is already in actual days (sum of all values), so we multiply by perDayRate directly
    if (calcCasualLeaveDays > 0) {
      const casualLeaveSalary = calcCasualLeaveDays * perDayRate;
      const casualLeaveDateCount = casualLeaveDates.filter(item => 
        attendanceBreakdown?.dailyBreakdown.some(day => day.date === item.date)
      ).length;
      // Calculate average value per date dynamically (can be 0.5 or 1.0 or mixed)
      const avgValuePerDate = casualLeaveDateCount > 0 ? calcCasualLeaveDays / casualLeaveDateCount : 0.5;
      breakdownBody.push([
        'Casual Leave Salary',
        `${casualLeaveDateCount} dates × ${formatPdfCurrency(perDayRate)} × ${avgValuePerDate.toFixed(1)} = ${formatPdfCurrency(casualLeaveSalary)} (${calcCasualLeaveDays.toFixed(1)} days)`
      ]);
    }
    
    // Sunday Pay
    if (paidSundays > 0 && salary.breakdown.sundayPay > 0) {
      breakdownBody.push([
        'Sunday Pay',
        `${paidSundays} days × ${formatPdfCurrency(perDayRate)} = +${formatPdfCurrency(salary.breakdown.sundayPay)}`
      ]);
    }
    
    // Overtime
    if (overtimeHours > 0 && salary.breakdown.overtimeAmount > 0) {
      const overtimeMultiplier = salary.breakdown.overtimeAmount / (overtimeHours * hourlyRate);
      breakdownBody.push([
        'Overtime',
        `${overtimeHours.toFixed(2)} hrs × ${formatPdfCurrency(hourlyRate)} × ${overtimeMultiplier.toFixed(2)} = +${formatPdfCurrency(salary.breakdown.overtimeAmount)}`
      ]);
    }
    
    // Late Deduction
    // Calculate actual days for deduction (after grace period)
    // 30+ min late days have no grace period, 10+ min late days have 3-day grace period
    if (lateDays > 0 && salary.breakdown.lateDeduction > 0) {
      const lateBy30MinutesDays = (salary.attendance as any).lateBy30MinutesDays || 0;
      const lateBy10MinutesDays = (salary.attendance as any).lateBy10MinutesDays || Math.max(0, lateDays - lateBy30MinutesDays);
      const lateDays10MinExceedingGrace = Math.max(0, lateBy10MinutesDays - 3); // Grace period: 3 days
      const actualLateDeductionDays = lateBy30MinutesDays + lateDays10MinExceedingGrace;
      
      // Calculate per-day deduction rate
      let lateDeductionPerDay = 0;
      if (actualLateDeductionDays > 0) {
        lateDeductionPerDay = salary.breakdown.lateDeduction / actualLateDeductionDays;
      } else {
        // Fallback: use total late days if calculation fails
        lateDeductionPerDay = salary.breakdown.lateDeduction / lateDays;
      }
      
      breakdownBody.push([
        'Late Deduction',
        `${actualLateDeductionDays} days × ${formatPdfCurrency(lateDeductionPerDay)} = -${formatPdfCurrency(salary.breakdown.lateDeduction)}`
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
    if (halfDays > 0 && salary.breakdown.halfDayDeduction > 0) {
      breakdownBody.push([
        'Half Day Deduction',
        `${halfDays} days × ${formatPdfCurrency(perDayRate)} × 0.5 = -${formatPdfCurrency(salary.breakdown.halfDayDeduction)}`
      ]);
    }
    
    // Loss of Pay Deduction
    if (lopDeduction > 0) {
      const lopDays = lopDeduction / perDayRate;
      breakdownBody.push([
        'Loss of Pay (LOP)',
        `${lopDays.toFixed(1)} × ${formatPdfCurrency(perDayRate)} = -${formatPdfCurrency(lopDeduction)}`
      ]);
    }
    
    // TDS Deduction (10% if basic salary < 15000)
    if (tdsDeduction > 0) {
      breakdownBody.push([
        'TDS Deduction',
        `10% of Net Salary = -${formatPdfCurrency(tdsDeduction)}`
      ]);
    }
    
    // Professional Tax (Rs. 200 if basic salary >= 15000)
    if (professionalTax > 0) {
      breakdownBody.push([
        'Professional Tax',
        ` - ${formatPdfCurrency(professionalTax)}`
      ]);
    }
    
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

    // Daily Attendance List (New Page - minimal ink, compact spacing)
    if (attendanceBreakdown && attendanceBreakdown.dailyBreakdown) {
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
      doc.text(`Daily Attendance of: ${selectedEmployee}`, 14, 28);
      
      // Prepare attendance data - filter based on joining/exit dates
      // First filter to get only relevant days
      const filteredDays = attendanceBreakdown.dailyBreakdown.filter(day => {
        // Skip days before joining date if "New Joining" toggle is ON
        if (isNewJoiner && joinDate && day.date < joinDate) {
          return false;
        }
        
        // Skip days after exit date if "Contract Cessation" toggle is ON
        if (isExited && exitDate && day.date > exitDate) {
          return false;
        }
        
        return true;
      });
      
      // Get backend-calculated paid Sundays count (already accounts for joining date and sandwich rule)
      const paidSundaysFromBackend = salary.attendance.sundaysInMonth || 0;
      
      // Find all Sundays in the filtered period and mark them as paid based on backend calculation
      const sundaysInFilteredPeriod = filteredDays
        .filter(day => {
          const dayOfWeek = new Date(day.date).getDay(); // 0 = Sunday
          return dayOfWeek === 0 && day.status === 'weekoff';
        })
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically
      
      // Mark first N Sundays as paid (where N = paidSundaysFromBackend)
      sundaysInFilteredPeriod.forEach((sunday, index) => {
        if (index < paidSundaysFromBackend) {
          (sunday as any).weekoffType = 'paid';
        } else {
          (sunday as any).weekoffType = 'unpaid';
        }
      });
      
      const attendanceData = filteredDays.map(day => {
        const date = new Date(day.date);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const firstEntry = day.firstEntry ? new Date(day.firstEntry).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
        const lastExit = day.lastExit ? new Date(day.lastExit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
        const hours = day.totalHours.toFixed(2);
        const status = day.status.toUpperCase();
        
        // Check if this date has approved leave, regularization, or weekoff payment status
        // Use backend's isRegularized flag if available (from attendance breakdown)
        const isRegularized = (day as any).isRegularized || regularizedDates.some(d => d.date === day.date);
        let leaveStatus = '';
        if (isRegularized) {
          // Get original status from backend or fallback to current status
          const originalStatus = (day as any).originalStatus || (day.status === 'full-day' ? 'absent' : day.status);
          leaveStatus = `REG (${originalStatus.toUpperCase()})`;
        } else if (paidLeaveDates.find(d => d.date === day.date)) {
          leaveStatus = 'PAID LEAVE';
        } else if (casualLeaveDates.find(d => d.date === day.date)) {
          leaveStatus = 'CASUAL LEAVE';
        } else if (day.status === 'weekoff') {
          // Show paid/unpaid status for weekoffs/Sundays
          // Backend already calculated weekoffType correctly when joinDate is passed
          const weekoffType = (day as any).weekoffType;
          leaveStatus = weekoffType === 'paid' ? 'PAID' : 'UNPAID';
        }
        
        // Build flags array (LATE, EARLY EXIT)
        let lateFlag = '';
        if (day.isLate && day.minutesLate !== null && day.minutesLate !== undefined) {
          lateFlag = `LATE (${day.minutesLate} min)`;
        }
        
        const flags = [
          lateFlag,
          day.isEarlyExit ? 'EARLY EXIT' : ''
        ].filter(Boolean).join(', ');
        
        // Calculate attendance value for new column
        let attendanceValue = '0';
        
        // Check if it's a paid leave first (overrides other statuses)
        if (paidLeaveDates.find(d => d.date === day.date)) {
          attendanceValue = '1';
        } else if (isRegularized) {
          // Regularized dates: get the regularization value and original status
          const regItem = regularizedDates.find(d => d.date === day.date);
          const originalStatus = (day as any).originalStatus || day.status;
          const currentStatus = day.status; // Status after regularization
          
          // Calculate hours worked before regularization
          let originalHoursWorked = 0;
          if (originalStatus === 'half-day') {
            originalHoursWorked = 0.5;
          } else if (originalStatus === 'absent') {
            originalHoursWorked = 0;
          } else if (originalStatus === 'full-day') {
            originalHoursWorked = 1.0;
          }
          
          // Get regularization value: prefer from state, otherwise derive from current status
          let regularizationValue: number;
          if (regItem && regItem.value !== undefined && regItem.value !== null) {
            // Use value from state (0.5 or 1.0)
            regularizationValue = regItem.value;
          } else {
            // Derive from current status after regularization
            // The current status tells us what it was regularized TO
            if (currentStatus === 'half-day') {
              // Regularized to half-day: value is the difference needed to reach 0.5
              regularizationValue = 0.5 - originalHoursWorked;
            } else if (currentStatus === 'full-day') {
              // Regularized to full-day: value is the difference needed to reach 1.0
              regularizationValue = 1.0 - originalHoursWorked;
            } else {
              // Fallback: default to 1.0
              regularizationValue = 1.0;
            }
          }
          
          // Total = original hours worked + regularization value (capped at 1.0)
          // Examples:
          // - Absent (0) + Half-day reg (0.5) = 0.5
          // - Absent (0) + Full-day reg (1.0) = 1.0
          // - Half-day worked (0.5) + Half-day reg (0.5) = 1.0
          // - Half-day worked (0.5) + Full-day reg (0.5) = 1.0 (capped)
          const totalValue = originalHoursWorked + regularizationValue;
          attendanceValue = String(Math.min(totalValue, 1.0));
        } else if (casualLeaveDates.find(d => d.date === day.date)) {
          // Casual leave: get the actual value (0.5 or 1.0) and check original status
          const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
          const casualLeaveValue = casualLeaveItem?.value || 0.5; // Default to 0.5 if not found
          const originalStatus = (day as any).originalStatus || day.status;
          
          if (originalStatus === 'half-day') {
            // Half-day worked (0.5) + Casual leave value = 0.5 + CL value
            // If CL is 0.5: 0.5 + 0.5 = 1.0
            // If CL is 1.0: 0.5 + 1.0 = 1.5 (cap at 1.0 for single day)
            attendanceValue = String(Math.min(0.5 + casualLeaveValue, 1.0));
          } else if (originalStatus === 'absent') {
            // Absent (0) + Casual leave value = CL value directly
            // If CL is 0.5: 0 + 0.5 = 0.5
            // If CL is 1.0: 0 + 1.0 = 1.0
            attendanceValue = String(casualLeaveValue);
          } else {
            // For other statuses (full-day, etc.), use casual leave value
            // This shouldn't normally happen, but handle it gracefully
            attendanceValue = String(casualLeaveValue);
          }
        } else if (day.status === 'full-day') {
          // Full day = 1
          attendanceValue = '1';
        } else if (day.status === 'half-day') {
          // Half day = 0.5
          attendanceValue = '0.5';
        } else if (day.status === 'absent') {
          // Absent = 0
          attendanceValue = '0';
        } else if (day.status === 'weekoff') {
          // Weekoff: check if paid or unpaid
          // Backend already calculated weekoffType correctly when joinDate is passed
          attendanceValue = (day as any).weekoffType === 'paid' ? '1' : '0';
        } else if (day.status === 'not-active') {
          // Not active = 0
          attendanceValue = '0';
        }
        
        return {
          row: [
            dateStr,
            firstEntry,
            lastExit,
            hours,
            status,
            flags,
            leaveStatus,
            attendanceValue,
          ],
          value: parseFloat(attendanceValue)
        };
      });
      
      // Calculate total of attendance values
      const totalValue = attendanceData.reduce((sum, item) => sum + item.value, 0);
      
      // Prepare body data (extract just the row arrays)
      const tableBody = attendanceData.map(item => item.row);
      
      // Add total row at the end
      tableBody.push([
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
        body: tableBody,
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
          fillColor: [250, 250, 250] // Very light gray, uses minimal ink
        },
        didParseCell: function(data: any) {
          // Style the total row (last row)
          if (data.row.index === tableBody.length - 1) {
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

    // Leave Balance (if available - compact spacing)
    const leaveInfo = (salary as any).leaveInfo;
    if (leaveInfo) {
      const finalY3 = (doc as any).lastAutoTable.finalY + 4;
      
      // Check if we need a new page
      if (finalY3 > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Leave Balance', 14, 20);
        
        autoTable(doc, {
          startY: 22,
          head: [['Leave Type', 'Count']],
          body: [
            ['Allowed Leaves (Annual)', `${leaveInfo.allowedLeaves} days`],
            ['Used Paid Leaves', `${leaveInfo.usedPaidLeaves} days`],
            ['Used Casual Leaves', `${leaveInfo.usedCasualLeaves} days`],
            ['Remaining Leaves', `${leaveInfo.remainingLeaves} days`],
            ...(leaveInfo.lossOfPayDays > 0 ? [['Loss of Pay Days', `${leaveInfo.lossOfPayDays} days`]] : []),
          ],
          theme: 'plain',
          headStyles: { 
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0],
            cellPadding: 3
          },
          bodyStyles: {
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            cellPadding: 3
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
          },
          margin: { left: 14, right: 14 },
        });
      } else {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Leave Balance', 14, finalY3);
        
        autoTable(doc, {
          startY: finalY3 + 2,
          head: [['Leave Type', 'Count']],
          body: [
            ['Allowed Leaves (Annual)', `${leaveInfo.allowedLeaves} days`],
            ['Used Paid Leaves', `${leaveInfo.usedPaidLeaves} days`],
            ['Used Casual Leaves', `${leaveInfo.usedCasualLeaves} days`],
            ['Remaining Leaves', `${leaveInfo.remainingLeaves} days`],
            ...(leaveInfo.lossOfPayDays > 0 ? [['Loss of Pay Days', `${leaveInfo.lossOfPayDays} days`]] : []),
          ],
          theme: 'plain',
          headStyles: { 
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0],
            cellPadding: 3
          },
          bodyStyles: {
            lineWidth: 0.1,
            lineColor: [200, 200, 200],
            cellPadding: 3
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' }
          },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Recent Attendance Analysis (Last 10 Working Days)
    // Data is now fetched from backend API at the start of this function
    // if (recentAttendanceData.length > 0) {
    //   const finalY4 = (doc as any).lastAutoTable.finalY + 6;
      
    //   // Check if we need a new page
    //   if (finalY4 > doc.internal.pageSize.getHeight() - 100) {
    //     doc.addPage();
    //   }
      
    //   const startY = finalY4 > doc.internal.pageSize.getHeight() - 100 ? 20 : finalY4;
      
    //   doc.setFontSize(12);
    //   doc.setFont('helvetica', 'bold');
    //   doc.text('Recent Attendance Analysis (Last 10 Working Days)', 14, startY);
      
    //   // Use the data fetched from the backend API
    //   var recentAttendance = recentAttendanceData;
      
    //   // Prepare table data
    //   const recentAttendanceBody = recentAttendance.map(item => {
    //     const date = new Date(item.date);
    //     const dateFormatted = date.toLocaleDateString('en-US', { 
    //       weekday: 'short', 
    //       month: 'short', 
    //       day: 'numeric',
    //       year: 'numeric'
    //     });
        
    //     let status = 'NO DATA';
        
    //     if (item.data) {
    //       status = item.data.status.toUpperCase();
    //     }
        
    //     return [dateFormatted, status];
    //   });
      
    //   // Analyze attendance pattern for prediction
    //   let absentCount = 0;
    //   let maxConsecutiveAbsents = 0;
    //   let currentConsecutiveAbsents = 0;
    //   let workingDaysCount = 0;
    //   let presentCount = 0;
      
    //   recentAttendance.forEach(item => {
    //     if (item.data) {
    //       if (item.data.status === 'absent') {
    //         absentCount++;
    //         currentConsecutiveAbsents++;
    //         maxConsecutiveAbsents = Math.max(maxConsecutiveAbsents, currentConsecutiveAbsents);
    //       } else if (item.data.status !== 'weekoff') {
    //         currentConsecutiveAbsents = 0;
    //         if (item.data.status === 'full-day' || item.data.status === 'half-day') {
    //           presentCount++;
    //         }
    //       }
          
    //       // Count working days (exclude weekoffs)
    //       if (item.data.status !== 'weekoff') {
    //         workingDaysCount++;
    //       }
    //     }
    //   });
      
    //   // Prediction logic
    //   const ABSENT_THRESHOLD = 7; // If 7 or more consecutive absents, predict left
    //   const ABSENT_PERCENTAGE_THRESHOLD = 80; // If 80% of working days are absent
      
    //   let prediction = '';
    //   let predictionStatus = 'ACTIVE'; // ACTIVE, AT_RISK, LIKELY_LEFT, CONCERNING
      
    //   const absentPercentage = workingDaysCount > 0 ? (absentCount / workingDaysCount) * 100 : 0;
      
    //   if (maxConsecutiveAbsents >= ABSENT_THRESHOLD) {
    //     prediction = `LIKELY LEFT - ${maxConsecutiveAbsents} consecutive absents detected`;
    //     predictionStatus = 'LIKELY_LEFT';
    //   } else if (absentPercentage >= ABSENT_PERCENTAGE_THRESHOLD) {
    //     prediction = `AT RISK - ${absentPercentage.toFixed(0)}% absence rate in last 10 days`;
    //     predictionStatus = 'AT_RISK';
    //   } else if (presentCount === 0 && workingDaysCount > 0) {
    //     prediction = 'CONCERNING - No presence in last 10 working days';
    //     predictionStatus = 'CONCERNING';
    //   } else {
    //     prediction = `ACTIVE - ${presentCount}/${workingDaysCount} working days present`;
    //     predictionStatus = 'ACTIVE';
    //   }
      
      // Create table
      // autoTable(doc, {
      //   startY: startY + 3,
      //   head: [['Date', 'Status']],
      //   body: recentAttendanceBody,
      //   theme: 'plain',
      //   headStyles: { 
      //     fillColor: [255, 255, 255],
      //     textColor: [0, 0, 0],
      //     fontStyle: 'bold',
      //     lineWidth: 0.5,
      //     lineColor: [0, 0, 0],
      //     cellPadding: 2,
      //     fontSize: 9
      //   },
      //   bodyStyles: {
      //     lineWidth: 0.1,
      //     lineColor: [200, 200, 200],
      //     cellPadding: 2,
      //     fontSize: 8,
      //     textColor: [0, 0, 0]
      //   },
      //   columnStyles: {
      //     0: { cellWidth: 90 },
      //     1: { cellWidth: 80, halign: 'center', fontStyle: 'bold' }
      //   },
      //   margin: { left: 14, right: 14 },
      // });
      
      // Add prediction section
      // const predictionY = (doc as any).lastAutoTable.finalY + 6;
      
      // doc.setTextColor(0, 0, 0);
      // doc.setFontSize(10);
      // doc.setFont('helvetica', 'bold');
      // doc.text('Prediction:', 14, predictionY);
      
      // // Draw simple prediction box with border only (minimal ink)
      // const boxX = 14;
      // const boxY = predictionY + 2;
      // const boxWidth = pageWidth - 28;
      // const boxHeight = 10;
      
      // doc.setDrawColor(0, 0, 0);
      // doc.setLineWidth(predictionStatus === 'LIKELY_LEFT' || predictionStatus === 'CONCERNING' ? 1 : 0.5);
      // doc.rect(boxX, boxY, boxWidth, boxHeight);
      
      // // Add prediction text (black text, no special characters)
      // doc.setTextColor(0, 0, 0);
      // doc.setFontSize(9);
      // doc.setFont('helvetica', 'bold');
      // doc.text(prediction, boxX + boxWidth / 2, boxY + 6.5, { align: 'center' });
      
      // // Add analysis summary
      // doc.setFontSize(8);
      // doc.setFont('helvetica', 'normal');
      // const summaryY = boxY + boxHeight + 5;
      // doc.text(`Analysis: ${absentCount} absents | ${presentCount} present | ${maxConsecutiveAbsents} max consecutive absents`, 14, summaryY);
    // }
    
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
    
    // Save PDF
    const fileName = `Salary_Report_${employeeName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`;
    doc.save(fileName);
  };

  const handleDownloadAllPDFs = async () => {
    setIsDownloadingAll(true);
    setDownloadAllProgress({ current: 0, total: 0 });

    try {
      // Fetch employees from EmployeeDetails table only
      const employeeDetailsResponse = await api.employeeDetails.getAll();
      const employeesWithDetails = employeeDetailsResponse.data.data || [];
      
      if (employeesWithDetails.length === 0) {
        alert('No employees found in EmployeeDetails table.');
        setIsDownloadingAll(false);
        setDownloadAllProgress(null);
        return;
      }

      setDownloadAllProgress({ current: 0, total: employeesWithDetails.length });

      // Batch processing configuration
      const BATCH_SIZE = 3; // Process 3 employees at a time to avoid server overload
      const DELAY_BETWEEN_BATCHES = 500; // 500ms delay between batches
      const DELAY_BETWEEN_REQUESTS = 200; // 200ms delay between individual requests

      let processedCount = 0;
      const errors: Array<{ employeeCode: string; error: string }> = [];
      const zip = new JSZip();

      // Process employees in batches
      for (let i = 0; i < employeesWithDetails.length; i += BATCH_SIZE) {
        const batch = employeesWithDetails.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel with delays
        const batchPromises = batch.map(async (employee: any, index: number) => {
          // Add delay between requests within batch
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }

          try {
            const employeeCode = employee.employeeNo || employee.EmployeeCode || employee.employeeCode;
            if (!employeeCode) {
              throw new Error('Employee code not found');
            }
            
            // Fetch salary data for this employee
            const salaryResponse = await api.salary.calculate(
              parseInt(String(employeeCode)),
              selectedMonth,
              undefined, // joinDate
              undefined, // exitDate
              [], // paidLeaveDates
              [] // casualLeaveDates
            );

            const salaryData = salaryResponse.data.data;
            if (!salaryData) {
              throw new Error('No salary data received');
            }

            // Fetch attendance breakdown
            let attendanceBreakdownData: AttendanceSummary | null = null;
            try {
              const breakdownResponse = await api.attendance.getSummary(
                parseInt(String(employeeCode)),
                selectedMonth
              );
              attendanceBreakdownData = breakdownResponse.data.data || null;
            } catch (err) {
              console.warn(`Failed to fetch attendance breakdown for ${employeeCode}:`, err);
              // Continue without attendance breakdown
            }

            // Fetch recent attendance data
            let recentAttendanceData: Array<{date: string, data: any}> = [];
            try {
              const userId = parseInt(String(employeeCode));
              const recentResponse = await api.salary.getRecentAttendance(userId);
              recentAttendanceData = recentResponse.data?.data?.recentAttendance || [];
            } catch (err) {
              console.warn(`Failed to fetch recent attendance for ${employeeCode}:`, err);
              // Continue without recent attendance
            }

            // Generate PDF in memory
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const employeeName = employee.name || employee.EmployeeName || 'Unknown';
            
            // Get employee details for leave dates (empty arrays for batch processing)
            const paidLeaveDates: LeaveDateWithValue[] = [];
            const casualLeaveDates: LeaveDateWithValue[] = [];
            const regularizedDates: Array<{ date: string; value: number }> = [];
            
            // Helper function to format currency
            const formatPdfCurrency = (amount: number): string => {
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
            
            let currentY = 50;
            doc.text(`Name: ${employeeName}`, 14, currentY);
            currentY += 5;
            doc.text(`Employee Code: ${employeeCode}`, 14, currentY);
            currentY += 5;
            doc.text(`Department: ${employee.department || employee.Department || 'N/A'}`, 14, currentY);
            currentY += 5;
            doc.text(`Designation: ${employee.designation || employee.Designation || 'N/A'}`, 14, currentY);
            
            const rightColX = 110;
            currentY = 50;
            doc.text(`Join Date: ${employee.joinDate || employee.JoiningDate || 'N/A'}`, rightColX, currentY);
            currentY += 5;
            doc.text(`Basic Salary: ${employee.basicSalary || employee.BasicSalary ? formatPdfCurrency(employee.basicSalary || employee.BasicSalary) : 'N/A'}`, rightColX, currentY);
            currentY += 5;
            doc.text(`Location: ${employee.location || employee.BranchLocation || employee.branchLocation || 'N/A'}`, rightColX, currentY);
            currentY += 5;
            doc.text(`Month: ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`, rightColX, currentY);
            
            // Salary Summary
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Salary Summary', 14, 75);
            
            const salaryBody: string[][] = [
              ['Base Salary', formatPdfCurrency(salaryData.baseSalary)],
              ['Gross Salary', formatPdfCurrency(salaryData.grossSalary)],
            ];

            if (salaryData.breakdown.incentiveAmount && salaryData.breakdown.incentiveAmount > 0) {
              salaryBody.push(['Incentive', `+${formatPdfCurrency(salaryData.breakdown.incentiveAmount)}`]);
            }
            
            // Display individual adjustments from adjustmentDetails (exclude incentive as it's already shown above)
            if (salaryData.breakdown.adjustmentDetails && salaryData.breakdown.adjustmentDetails.length > 0) {
              salaryData.breakdown.adjustmentDetails
                .filter((adj: any) => adj.category !== 'INCENTIVE') // Exclude incentive to avoid duplication
                .forEach((adj: any) => {
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
              ['Total Deductions', `-${formatPdfCurrency(salaryData.breakdown.totalDeductions)}`],
              ['Net Salary', formatPdfCurrency(salaryData.netSalary)]
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
            
            // Calculate summary statistics from attendance breakdown
            let presentDays = 0;
            let halfPresentDays = 0;
            let paidLeaveDays = 0;
            let casualLeaveDays = 0;
            let lossOfPayDays = 0;
            const totalDays = salaryData.attendance.totalDays;
            const totalPayableDays = salaryData.attendance.totalPayableDays;
            const weekoffPaidDays = salaryData.attendance.sundaysInMonth || 0;
            
            if (attendanceBreakdownData && attendanceBreakdownData.dailyBreakdown) {
              attendanceBreakdownData.dailyBreakdown.forEach(day => {
                const paidLeaveItem = paidLeaveDates.find(d => d.date === day.date);
                if (paidLeaveItem) {
                  paidLeaveDays += paidLeaveItem.value;
                } else {
                  const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
                  if (casualLeaveItem) {
                    casualLeaveDays += casualLeaveItem.value;
                    const originalStatus = (day as any).originalStatus || day.status;
                    if (originalStatus === 'half-day') {
                      halfPresentDays++;
                    }
                  } else if (day.status === 'full-day') {
                    presentDays++;
                  } else if (day.status === 'half-day') {
                    halfPresentDays++;
                  } else if (day.status === 'absent') {
                    lossOfPayDays++;
                  }
                }
              });
            }
            
            const totalPaidLeaveDays = paidLeaveDates.reduce((sum, item) => sum + item.value, 0);
            const totalCasualLeaveDays = casualLeaveDates.reduce((sum, item) => sum + item.value, 0);
            const totalLeaveAndLOP = lossOfPayDays + totalPaidLeaveDays + totalCasualLeaveDays;
            const payDays = salaryData.attendance.totalPayableDays;
            
            const summaryBody = [
              ['Present', `${presentDays}`],
              ['Half Present', `${halfPresentDays}`],
              ['Paid Leave (PL)', `${paidLeaveDays}`],
              ['Casual Leave (CL)', `${casualLeaveDays.toFixed(1)}`],
              ['WO', `${weekoffPaidDays}`],
              ['LOP', `${lossOfPayDays}`],
              ['TOTAL', `${totalPayableDays}/${totalDays}`],
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
            const perDayRate = salaryData.breakdown.perDayRate;
            const hourlyRate = salaryData.breakdown.hourlyRate;
            const fullDaysCount = salaryData.attendance.fullDays;
            const absentDays = salaryData.attendance.absentDays;
            const lateDays = salaryData.attendance.lateDays;
            const paidSundays = salaryData.attendance.sundaysInMonth;
            const overtimeHours = salaryData.attendance.overtimeHours || 0;
            const lopDeduction = (salaryData.breakdown as any).lopDeduction || 0;
            const tdsDeduction = (salaryData.breakdown as any).tdsDeduction || 0;
            const professionalTax = (salaryData.breakdown as any).professionalTax || 0;
            const halfDays = salaryData.attendance.halfDays;
            
            // Calculate paid leave and casual leave days from attendance breakdown
            let calcPaidLeaveDays = 0;
            let calcCasualLeaveDays = 0;
            if (attendanceBreakdownData && attendanceBreakdownData.dailyBreakdown) {
              attendanceBreakdownData.dailyBreakdown.forEach(day => {
                const paidLeaveItem = paidLeaveDates.find(d => d.date === day.date);
                if (paidLeaveItem) {
                  calcPaidLeaveDays += paidLeaveItem.value;
                } else {
                  const casualLeaveItem = casualLeaveDates.find(d => d.date === day.date);
                  if (casualLeaveItem) {
                    calcCasualLeaveDays += casualLeaveItem.value;
                  }
                }
              });
            }
            
            // Build formula table body
            const breakdownBody = [];
            
            if (fullDaysCount > 0) {
              const presentSalary = fullDaysCount * perDayRate;
              breakdownBody.push([
                'Present Days Salary',
                `${fullDaysCount} days × ${formatPdfCurrency(perDayRate)} = ${formatPdfCurrency(presentSalary)}`
              ]);
            }
            
            if (halfDays > 0) {
              const halfDaySalary = halfDays * perDayRate * 0.5;
              breakdownBody.push([
                'Half Day Salary',
                `${halfDays} days × ${formatPdfCurrency(perDayRate)} × 0.5 = ${formatPdfCurrency(halfDaySalary)}`
              ]);
            }
            
            if (calcPaidLeaveDays > 0) {
              const paidLeaveSalary = calcPaidLeaveDays * perDayRate;
              breakdownBody.push([
                'Paid Leave Salary',
                `${calcPaidLeaveDays} days × ${formatPdfCurrency(perDayRate)} = ${formatPdfCurrency(paidLeaveSalary)}`
              ]);
            }
            
            if (calcCasualLeaveDays > 0) {
              const casualLeaveSalary = calcCasualLeaveDays * perDayRate;
              const casualLeaveDateCount = casualLeaveDates.filter(item => 
                attendanceBreakdownData?.dailyBreakdown.some(day => day.date === item.date)
              ).length;
              const avgValuePerDate = casualLeaveDateCount > 0 ? calcCasualLeaveDays / casualLeaveDateCount : 0.5;
              breakdownBody.push([
                'Casual Leave Salary',
                `${casualLeaveDateCount} dates × ${formatPdfCurrency(perDayRate)} × ${avgValuePerDate.toFixed(1)} = ${formatPdfCurrency(casualLeaveSalary)} (${calcCasualLeaveDays.toFixed(1)} days)`
              ]);
            }
            
            if (paidSundays > 0 && salaryData.breakdown.sundayPay > 0) {
              breakdownBody.push([
                'Sunday Pay',
                `${paidSundays} days × ${formatPdfCurrency(perDayRate)} = +${formatPdfCurrency(salaryData.breakdown.sundayPay)}`
              ]);
            }
            
            if (overtimeHours > 0 && salaryData.breakdown.overtimeAmount > 0) {
              const overtimeMultiplier = salaryData.breakdown.overtimeAmount / (overtimeHours * hourlyRate);
              breakdownBody.push([
                'Overtime',
                `${overtimeHours.toFixed(2)} hrs × ${formatPdfCurrency(hourlyRate)} × ${overtimeMultiplier.toFixed(2)} = +${formatPdfCurrency(salaryData.breakdown.overtimeAmount)}`
              ]);
            }
            
            if (lateDays > 0 && salaryData.breakdown.lateDeduction > 0) {
              const lateBy30MinutesDays = (salaryData.attendance as any).lateBy30MinutesDays || 0;
              const lateBy10MinutesDays = (salaryData.attendance as any).lateBy10MinutesDays || Math.max(0, lateDays - lateBy30MinutesDays);
              const lateDays10MinExceedingGrace = Math.max(0, lateBy10MinutesDays - 3);
              const actualLateDeductionDays = lateBy30MinutesDays + lateDays10MinExceedingGrace;
              
              let lateDeductionPerDay = 0;
              if (actualLateDeductionDays > 0) {
                lateDeductionPerDay = salaryData.breakdown.lateDeduction / actualLateDeductionDays;
              } else {
                lateDeductionPerDay = salaryData.breakdown.lateDeduction / lateDays;
              }
              
              breakdownBody.push([
                'Late Deduction',
                `${actualLateDeductionDays} days × ${formatPdfCurrency(lateDeductionPerDay)} = -${formatPdfCurrency(salaryData.breakdown.lateDeduction)}`
              ]);
            }
            
            if (absentDays > 0) {
              const absentDaysDeduction = absentDays * perDayRate;
              breakdownBody.push([
                'Absent Deduction',
                `${absentDays} days × ${formatPdfCurrency(perDayRate)} = -${formatPdfCurrency(absentDaysDeduction)}`
              ]);
            }
            
            if (halfDays > 0 && salaryData.breakdown.halfDayDeduction > 0) {
              breakdownBody.push([
                'Half Day Deduction',
                `${halfDays} days × ${formatPdfCurrency(perDayRate)} × 0.5 = -${formatPdfCurrency(salaryData.breakdown.halfDayDeduction)}`
              ]);
            }
            
            if (lopDeduction > 0) {
              const lopDays = lopDeduction / perDayRate;
              breakdownBody.push([
                'Loss of Pay (LOP)',
                `${lopDays.toFixed(1)} × ${formatPdfCurrency(perDayRate)} = -${formatPdfCurrency(lopDeduction)}`
              ]);
            }
            
            if (tdsDeduction > 0) {
              breakdownBody.push([
                'TDS Deduction',
                `10% of Net Salary = -${formatPdfCurrency(tdsDeduction)}`
              ]);
            }
            
            if (professionalTax > 0) {
              breakdownBody.push([
                'Professional Tax',
                ` - ${formatPdfCurrency(professionalTax)}`
              ]);
            }
            
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

            // Daily Attendance List (New Page)
            if (attendanceBreakdownData && attendanceBreakdownData.dailyBreakdown) {
              doc.addPage();
              
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.5);
              doc.line(14, 20, pageWidth - 14, 20);
              
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(16);
              doc.setFont('helvetica', 'bold');
              doc.text('DAILY ATTENDANCE RECORD', pageWidth / 2, 15, { align: 'center' });
              
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text(`Daily Attendance of: ${employeeCode}`, 14, 28);
              
              const filteredDays = attendanceBreakdownData.dailyBreakdown;
              const paidSundaysFromBackend = salaryData.attendance.sundaysInMonth || 0;
              
              const sundaysInFilteredPeriod = filteredDays
                .filter(day => {
                  const dayOfWeek = new Date(day.date).getDay();
                  return dayOfWeek === 0 && day.status === 'weekoff';
                })
                .sort((a, b) => a.date.localeCompare(b.date));
              
              sundaysInFilteredPeriod.forEach((sunday, index) => {
                if (index < paidSundaysFromBackend) {
                  (sunday as any).weekoffType = 'paid';
                } else {
                  (sunday as any).weekoffType = 'unpaid';
                }
              });
              
              const attendanceData = filteredDays.map(day => {
                const date = new Date(day.date);
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                const firstEntry = day.firstEntry ? new Date(day.firstEntry).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
                const lastExit = day.lastExit ? new Date(day.lastExit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
                const hours = day.totalHours.toFixed(2);
                const status = day.status.toUpperCase();
                
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
                
                let lateFlag = '';
                if (day.isLate && day.minutesLate !== null && day.minutesLate !== undefined) {
                  lateFlag = `LATE (${day.minutesLate} min)`;
                }
                
                const flags = [
                  lateFlag,
                  day.isEarlyExit ? 'EARLY EXIT' : ''
                ].filter(Boolean).join(', ');
                
                let attendanceValue = '0';
                if (paidLeaveDates.find(d => d.date === day.date)) {
                  attendanceValue = '1';
                } else if (isRegularized) {
                  const regItem = regularizedDates.find(d => d.date === day.date);
                  const originalStatus = (day as any).originalStatus || day.status;
                  const currentStatus = day.status;
                  
                  let originalHoursWorked = 0;
                  if (originalStatus === 'half-day') {
                    originalHoursWorked = 0.5;
                  } else if (originalStatus === 'absent') {
                    originalHoursWorked = 0;
                  } else if (originalStatus === 'full-day') {
                    originalHoursWorked = 1.0;
                  }
                  
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
                
                return {
                  row: [
                    dateStr,
                    firstEntry,
                    lastExit,
                    hours,
                    status,
                    flags,
                    leaveStatus,
                    attendanceValue,
                  ],
                  value: parseFloat(attendanceValue)
                };
              });
              
              const totalValue = attendanceData.reduce((sum, item) => sum + item.value, 0);
              const tableBody = attendanceData.map(item => item.row);
              
              tableBody.push([
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
                body: tableBody,
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
                  if (data.row.index === tableBody.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                    data.cell.styles.lineWidth = 0.5;
                    data.cell.styles.lineColor = [0, 0, 0];
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

            // Leave Balance (if available)
            const leaveInfo = (salaryData as any).leaveInfo;
            if (leaveInfo) {
              const finalY3 = (doc as any).lastAutoTable.finalY + 4;
              
              if (finalY3 > doc.internal.pageSize.getHeight() - 80) {
                doc.addPage();
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Leave Balance', 14, 20);
                
                autoTable(doc, {
                  startY: 22,
                  head: [['Leave Type', 'Count']],
                  body: [
                    ['Allowed Leaves (Annual)', `${leaveInfo.allowedLeaves} days`],
                    ['Used Paid Leaves', `${leaveInfo.usedPaidLeaves} days`],
                    ['Used Casual Leaves', `${leaveInfo.usedCasualLeaves} days`],
                    ['Remaining Leaves', `${leaveInfo.remainingLeaves} days`],
                    ...(leaveInfo.lossOfPayDays > 0 ? [['Loss of Pay Days', `${leaveInfo.lossOfPayDays} days`]] : []),
                  ],
                  theme: 'plain',
                  headStyles: { 
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.5,
                    lineColor: [0, 0, 0],
                    cellPadding: 3
                  },
                  bodyStyles: {
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200],
                    cellPadding: 3
                  },
                  columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { halign: 'right' }
                  },
                  margin: { left: 14, right: 14 },
                });
              } else {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Leave Balance', 14, finalY3);
                
                autoTable(doc, {
                  startY: finalY3 + 2,
                  head: [['Leave Type', 'Count']],
                  body: [
                    ['Allowed Leaves (Annual)', `${leaveInfo.allowedLeaves} days`],
                    ['Used Paid Leaves', `${leaveInfo.usedPaidLeaves} days`],
                    ['Used Casual Leaves', `${leaveInfo.usedCasualLeaves} days`],
                    ['Remaining Leaves', `${leaveInfo.remainingLeaves} days`],
                    ...(leaveInfo.lossOfPayDays > 0 ? [['Loss of Pay Days', `${leaveInfo.lossOfPayDays} days`]] : []),
                  ],
                  theme: 'plain',
                  headStyles: { 
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.5,
                    lineColor: [0, 0, 0],
                    cellPadding: 3
                  },
                  bodyStyles: {
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200],
                    cellPadding: 3
                  },
                  columnStyles: {
                    0: { fontStyle: 'bold' },
                    1: { halign: 'right' }
                  },
                  margin: { left: 14, right: 14 },
                });
              }
            }

            // Recent Attendance Analysis (Last 10 Working Days)
            if (recentAttendanceData.length > 0) {
              const finalY4 = (doc as any).lastAutoTable.finalY + 6;
              
              if (finalY4 > doc.internal.pageSize.getHeight() - 100) {
                doc.addPage();
              }
              
              const startY = finalY4 > doc.internal.pageSize.getHeight() - 100 ? 20 : finalY4;
              
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Recent Attendance Analysis (Last 10 Working Days)', 14, startY);
              
              const recentAttendance = recentAttendanceData;
              
              const recentAttendanceBody = recentAttendance.map(item => {
                const date = new Date(item.date);
                const dateFormatted = date.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });
                
                let status = 'NO DATA';
                if (item.data) {
                  status = item.data.status.toUpperCase();
                }
                
                return [dateFormatted, status];
              });
              
              let absentCount = 0;
              let maxConsecutiveAbsents = 0;
              let currentConsecutiveAbsents = 0;
              let workingDaysCount = 0;
              let presentCount = 0;
              
              recentAttendance.forEach(item => {
                if (item.data) {
                  if (item.data.status === 'absent') {
                    absentCount++;
                    currentConsecutiveAbsents++;
                    maxConsecutiveAbsents = Math.max(maxConsecutiveAbsents, currentConsecutiveAbsents);
                  } else if (item.data.status !== 'weekoff') {
                    currentConsecutiveAbsents = 0;
                    if (item.data.status === 'full-day' || item.data.status === 'half-day') {
                      presentCount++;
                    }
                  }
                  
                  if (item.data.status !== 'weekoff') {
                    workingDaysCount++;
                  }
                }
              });
              
              const ABSENT_THRESHOLD = 7;
              const ABSENT_PERCENTAGE_THRESHOLD = 80;
              
              let prediction = '';
              let predictionStatus = 'ACTIVE';
              
              const absentPercentage = workingDaysCount > 0 ? (absentCount / workingDaysCount) * 100 : 0;
              
              if (maxConsecutiveAbsents >= ABSENT_THRESHOLD) {
                prediction = `LIKELY LEFT - ${maxConsecutiveAbsents} consecutive absents detected`;
                predictionStatus = 'LIKELY_LEFT';
              } else if (absentPercentage >= ABSENT_PERCENTAGE_THRESHOLD) {
                prediction = `AT RISK - ${absentPercentage.toFixed(0)}% absence rate in last 10 days`;
                predictionStatus = 'AT_RISK';
              } else if (presentCount === 0 && workingDaysCount > 0) {
                prediction = 'CONCERNING - No presence in last 10 working days';
                predictionStatus = 'CONCERNING';
              } else {
                prediction = `ACTIVE - ${presentCount}/${workingDaysCount} working days present`;
                predictionStatus = 'ACTIVE';
              }
              
              autoTable(doc, {
                startY: startY + 3,
                head: [['Date', 'Status']],
                body: recentAttendanceBody,
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
                  fontSize: 8,
                  textColor: [0, 0, 0]
                },
                columnStyles: {
                  0: { cellWidth: 90 },
                  1: { cellWidth: 80, halign: 'center', fontStyle: 'bold' }
                },
                margin: { left: 14, right: 14 },
              });
              
              // Prediction section commented out
              // const predictionY = (doc as any).lastAutoTable.finalY + 6;
              
              // doc.setTextColor(0, 0, 0);
              // doc.setFontSize(10);
              // doc.setFont('helvetica', 'bold');
              // doc.text('Prediction:', 14, predictionY);
              
              // const boxX = 14;
              // const boxY = predictionY + 2;
              // const boxWidth = pageWidth - 28;
              // const boxHeight = 10;
              
              // doc.setDrawColor(0, 0, 0);
              // doc.setLineWidth(predictionStatus === 'LIKELY_LEFT' || predictionStatus === 'CONCERNING' ? 1 : 0.5);
              // doc.rect(boxX, boxY, boxWidth, boxHeight);
              
              // doc.setTextColor(0, 0, 0);
              // doc.setFontSize(9);
              // doc.setFont('helvetica', 'bold');
              // doc.text(prediction, boxX + boxWidth / 2, boxY + 6.5, { align: 'center' });
              
              // doc.setFontSize(8);
              // doc.setFont('helvetica', 'normal');
              // const summaryY = boxY + boxHeight + 5;
              // doc.text(`Analysis: ${absentCount} absents | ${presentCount} present | ${maxConsecutiveAbsents} max consecutive absents`, 14, summaryY);
            }

            // Footer
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
            
            // Get PDF as ArrayBuffer and add to ZIP
            const pdfBlob = doc.output('arraybuffer');
            const fileName = `Salary_Report_${employeeName.replace(/\s+/g, '_')}_${employeeCode}_${selectedMonth}.pdf`;
            zip.file(fileName, pdfBlob);
            
            processedCount++;
            setDownloadAllProgress({ current: processedCount, total: employeesWithDetails.length });
          } catch (err: any) {
            console.error(`Failed to generate PDF for ${employee.employeeNo || employee.EmployeeCode}:`, err);
            errors.push({
              employeeCode: employee.employeeNo || employee.EmployeeCode || 'Unknown',
              error: err.response?.data?.message || err.message || 'Unknown error'
            });
            processedCount++;
            setDownloadAllProgress({ current: processedCount, total: employeesWithDetails.length });
          }
        });

        await Promise.all(batchPromises);
        
        // Delay between batches
        if (i + BATCH_SIZE < employeesWithDetails.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      // Generate ZIP file and download
      if (processedCount - errors.length > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = zipUrl;
        const monthDate = new Date(selectedMonth + '-01');
        const monthName = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        link.download = `Salary_Reports_${monthName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(zipUrl);

        // Show completion message
        if (errors.length > 0) {
          alert(`Downloaded ${processedCount - errors.length} PDFs successfully in ZIP file. ${errors.length} failed:\n${errors.slice(0, 5).map(e => `${e.employeeCode}: ${e.error}`).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
        } else {
          alert(`Successfully downloaded ${processedCount} salary reports in ZIP file!`);
        }
      } else {
        alert('No PDFs were generated. Please check the errors.');
      }
    } catch (err: any) {
      console.error('Failed to download all PDFs:', err);
      alert('Failed to download PDFs. Please try again.');
    } finally {
      setIsDownloadingAll(false);
      setDownloadAllProgress(null);
    }
  };

  // Calculate max date for custom end date (last day of selected month)
  const getMaxDate = () => {
    if (!selectedMonth) return undefined;
    const [year, month] = selectedMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    return `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-wrap gap-6 items-center justify-between animate-fade-in">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-500 rounded-full" />
            <h1 className="text-4xl font-bold text-white tracking-tight">Payroll</h1>
          </div>
          <p className="text-slate-400 font-medium pl-4">
            Compensation models and disbursement schedules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedMonth && (
            <button
              onClick={async () => {
                if (!selectedMonth) return;
                
                const confirmed = window.confirm(
                  `Are you sure you want to publish/finalize ALL salaries for ${selectedMonth}?\n\n` +
                  'This will finalize all DRAFT salaries for this month, making them visible to employees.\n\n' +
                  'This action cannot be undone.'
                );
                
                if (!confirmed) return;
                
                setIsFinalizingAll(true);
                try {
                  const response = await api.salary.finalizeAll(selectedMonth);
                  
                  if (response.data.success) {
                    alert(`Successfully finalized ${response.data.data?.updated || 0} salary record(s) for ${selectedMonth}`);
                    // Optionally refresh the current salary if one is selected
                    if (selectedEmployee) {
                      setIsFinalized(true);
                    }
                  }
                } catch (err: any) {
                  console.error('Failed to finalize all salaries:', err);
                  alert(err.response?.data?.message || 'Failed to finalize all salaries');
                } finally {
                  setIsFinalizingAll(false);
                }
              }}
              disabled={isFinalizingAll || !selectedMonth}
              className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFinalizingAll ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Calendar className="h-5 w-5" />
                  Publish All Salaries
                </>
              )}
            </button>
          )}
          {selectedEmployee && salary && (
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingAll}
              className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5" />
              Download Report
            </button>
          )}
          {/* <button
            onClick={handleDownloadAllPDFs}
            disabled={isDownloadingAll || employees.length === 0}
            className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloadingAll ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Downloading... ({downloadAllProgress ? `${downloadAllProgress.current}/${downloadAllProgress.total}` : '0'})
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Download All Reports
              </>
            )}
          </button> */}
        </div>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SearchableSelect
          label="Entity Search"
          value={selectedEmployee}
          onChange={(value) => handleEmployeeChange(value)}
          placeholder="Search and select personnel..."
          options={employees.map(emp => ({
            value: emp.employeeNo,
            label: `[${emp.employeeNo}] ${emp.name}`
          }))}
        />
        <Input
          type="month"
          label="Financial Cycle"
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
        />
        <Input
          type="date"
          label="Custom End Date (Optional)"
          value={customEndDate}
          onChange={(e) => setCustomEndDate(e.target.value)}
          placeholder="Calculate up to specific date"
          max={getMaxDate()}
        />
      </div>

      {/* Leave Approval Buttons (Only for salary >= 15000) */}
      {selectedEmployee && attendanceBreakdown && salary && salary.baseSalary >= 15000 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setShowPaidLeaveModal(true)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-[20px] font-bold text-sm border border-emerald-500/20 transition-all active:scale-95"
            >
              <Calendar className="h-5 w-5" />
              Paid Leave Approval
              {paidLeaveDates.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                  {paidLeaveDates.reduce((sum, item) => sum + item.value, 0).toFixed(1)}d
                </span>
              )}
            </button>
            <button
              onClick={() => setShowCasualLeaveModal(true)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-[20px] font-bold text-sm border border-amber-500/20 transition-all active:scale-95"
            >
              <Calendar className="h-5 w-5" />
              Casual Leave Approval
              {casualLeaveDates.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                  {casualLeaveDates.reduce((sum, item) => sum + item.value, 0).toFixed(1)}d
                </span>
              )}
            </button>
          </div>
          {/* Auto-save indicators for leave */}
          {isSavingLeave && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                Saving leave approvals...
              </span>
            </div>
          )}
          {!isSavingLeave && leaveLoadedFromDB && (paidLeaveDates.length > 0 || casualLeaveDates.length > 0) && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                Leave approvals saved
              </span>
            </div>
          )}
        </div>
      )}

      {/* Attendance Regularization Button (Visible for all employees) */}
      {selectedEmployee && attendanceBreakdown && salary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-6">
            <button
              onClick={() => setShowRegularizationModal(true)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-[20px] font-bold text-sm border border-blue-500/20 transition-all active:scale-95"
            >
              <Calendar className="h-5 w-5" />
              Attendance Regularization
              {regularizedDates.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black">
                  {regularizedDates.length}
                </span>
              )}
            </button>
          </div>
          {/* Auto-save indicators for regularization */}
          {isSavingRegularization && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                Saving regularizations...
              </span>
            </div>
          )}
          {!isSavingRegularization && regularizationLoadedFromDB && regularizedDates.length > 0 && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                Regularizations saved
              </span>
            </div>
          )}
        </div>
      )}

      {/* Overtime Toggle (Visible for all employees) */}
      {selectedEmployee && attendanceBreakdown && salary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Overtime</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {isOvertimeEnabled 
                      ? `Enabled - ${(salary.attendance.overtimeHours || 0).toFixed(2)} hours × ₹${(salary.breakdown.hourlyRate || 0).toFixed(2)} = +${formatCurrency(salary.breakdown.overtimeAmount || 0)}`
                      : 'Disabled - Overtime not calculated'}
                  </span>
                </div>
                <button
                  onClick={() => saveOvertimeStatus(!isOvertimeEnabled)}
                  disabled={isSavingOvertime}
                  className={`w-12 h-6 rounded-full transition-all relative ${isOvertimeEnabled ? 'bg-indigo-600' : 'bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isOvertimeEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
          {/* Auto-save indicators for overtime */}
          {isSavingOvertime && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                Saving overtime status...
              </span>
            </div>
          )}
          {!isSavingOvertime && overtimeLoadedFromDB && isOvertimeEnabled && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                Overtime enabled
              </span>
            </div>
          )}
        </div>
      )}

      {/* Salary Hold Section (Visible for all employees) */}
      {selectedEmployee && salary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-6">
            {salaryHold && !salaryHold.IsReleased ? (
              // Salary is held - show release button
              <div className="p-6 rounded-[32px] bg-red-600/20 border-2 border-red-500/50 backdrop-blur-sm animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-red-400 uppercase tracking-widest mb-2">
                      ⏸️ SALARY IS ON HOLD
                    </span>
                    <span className="text-xs font-bold text-red-300 mb-1">
                      Hold Type: <span className="text-red-400">{salaryHold.HoldType}</span>
                      {salaryHold.Reason && (
                        <>
                          <span className="mx-2">|</span>
                          Reason: <span className="text-red-400">{salaryHold.Reason}</span>
                        </>
                      )}
                    </span>
                    {salaryHold.CreatedAt && (
                      <span className="text-[10px] font-bold text-red-400/70 mt-1">
                        Held on: {new Date(salaryHold.CreatedAt).toLocaleDateString()} at {new Date(salaryHold.CreatedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={releaseSalaryHold}
                    disabled={isSavingHold}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingHold ? 'Releasing...' : 'Release Hold'}
                  </button>
                </div>
                <div className="text-xs text-red-300/80 bg-red-600/10 p-3 rounded-lg border border-red-500/20">
                  ⚠️ <strong>Important:</strong> This employee's salary is excluded from salary summary until released.
                </div>
              </div>
            ) : (
              // Salary is not held - show hold button
              <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white uppercase tracking-widest mb-1">
                      Salary Hold
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Manually hold salary for this employee
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={createSalaryHold}
                      disabled={isSavingHold || isLoadingHold}
                      className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingHold ? 'Holding...' : 'Hold Salary'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Held salaries are excluded from salary summary and cannot be processed until released.
                </div>
              </div>
            )}
          </div>
          {/* Loading indicator */}
          {isLoadingHold && (
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                Loading hold status...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Contractual Status Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
      <div className="p-4 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white uppercase tracking-widest">New Joining</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pro-rata calculation from start date</span>
            </div>
            <button
              onClick={async () => {
                const newValue = !isNewJoiner;
                setIsNewJoiner(newValue);
                
                // If toggling ON, fetch joining date from backend
                if (newValue && selectedEmployee && !joinDate) {
                  try {
                    const response = await api.employeeDetails.getByCode(selectedEmployee);
                    if (response.data.success && response.data.data?.joiningDate) {
                      const joiningDate = response.data.data.joiningDate;
                      const formattedJoinDate = joiningDate.split('T')[0];
                      
                      // Check if joining date falls within the current salary cycle
                      if (isDateInSalaryCycle(formattedJoinDate, selectedMonth)) {
                        setJoinDate(formattedJoinDate);
                        console.log('[Salary] Auto-fetched joining date:', formattedJoinDate);
                      } else {
                        // Joining date is outside the salary cycle - turn toggle back OFF
                        setIsNewJoiner(false);
                        const cycle = getSalaryCycleRange(selectedMonth);
                        console.log('[Salary] Cannot enable joining toggle - joining date is outside salary cycle');
                        alert(`This employee joined on ${formattedJoinDate}, which is outside the current salary cycle (${cycle.start} to ${cycle.end}).`);
                      }
                    }
                  } catch (err: any) {
                    console.warn('[Salary] Could not fetch joining date:', err.response?.data?.message || err.message);
                  }
                } else if (!newValue) {
                  // If toggling OFF, clear the date
                  setJoinDate('');
                }
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${isNewJoiner ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isNewJoiner ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          {isNewJoiner && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Input
                type="date"
                label="Commencement Date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
              />
            </div>
          )}
        </div>
        </div>

        <div className="p-4 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
        <div className="space-y-4 border-l border-white/5 pl-6 md:border-l md:block hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white uppercase tracking-widest">Contract Cessation</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Final settlement up to exit date</span>
            </div>
            <button
              onClick={async () => {
                const newValue = !isExited;
                setIsExited(newValue);
                
                // If toggling ON, fetch exit date from backend
                if (newValue && selectedEmployee && !exitDate) {
                  try {
                    const response = await api.employeeDetails.getByCode(selectedEmployee);
                    if (response.data.success && response.data.data?.exitDate) {
                      const exitDateValue = response.data.data.exitDate;
                      const formattedExitDate = exitDateValue.split('T')[0];
                      setExitDate(formattedExitDate);
                      console.log('[Salary] Auto-fetched exit date:', formattedExitDate);
                    }
                  } catch (err: any) {
                    console.warn('[Salary] Could not fetch exit date:', err.response?.data?.message || err.message);
                  }
                } else if (!newValue) {
                  // If toggling OFF, clear the date
                  setExitDate('');
                }
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${isExited ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isExited ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          {isExited && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Input
                type="date"
                label="Cessation Date"
                value={exitDate}
                onChange={async (e) => {
                  const newExitDate = e.target.value;
                  setExitDate(newExitDate);
                  
                  // Save/Update exit date to backend whenever date changes (including updates)
                  if (newExitDate && selectedEmployee) {
                    try {
                      console.log('[Salary] Saving/updating exit date to backend:', newExitDate);
                      await api.employeeDetails.markAsExited(selectedEmployee, newExitDate, 'admin');
                      console.log('[Salary] ✅ Exit date saved/updated successfully');
                      setError(''); // Clear any previous errors
                    } catch (err: any) {
                      console.error('[Salary] Could not save exit date:', err.response?.data?.message || err.message);
                      setError(`Failed to save exit date: ${err.response?.data?.message || err.message}`);
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
        </div>

        {/* Mobile View for Cessation */}
        
        <div className="space-y-4 md:hidden">
          
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white uppercase tracking-widest">Contract Cessation</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Final settlement up to exit date</span>
            </div>
            <button
              onClick={async () => {
                const newValue = !isExited;
                setIsExited(newValue);
                
                // If toggling ON, fetch exit date from backend
                if (newValue && selectedEmployee && !exitDate) {
                  try {
                    const response = await api.employeeDetails.getByCode(selectedEmployee);
                    if (response.data.success && response.data.data?.exitDate) {
                      const exitDateValue = response.data.data.exitDate;
                      const formattedExitDate = exitDateValue.split('T')[0];
                      setExitDate(formattedExitDate);
                      console.log('[Salary] Auto-fetched exit date:', formattedExitDate);
                    }
                  } catch (err: any) {
                    console.warn('[Salary] Could not fetch exit date:', err.response?.data?.message || err.message);
                  }
                } else if (!newValue) {
                  // If toggling OFF, clear the date
                  setExitDate('');
                }
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${isExited ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isExited ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          {isExited && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <Input
                type="date"
                label="Cessation Date"
                value={exitDate}
                onChange={async (e) => {
                  const newExitDate = e.target.value;
                  setExitDate(newExitDate);
                  
                  // Save/Update exit date to backend whenever date changes (including updates)
                  if (newExitDate && selectedEmployee) {
                    try {
                      console.log('[Salary] Saving/updating exit date to backend:', newExitDate);
                      await api.employeeDetails.markAsExited(selectedEmployee, newExitDate, 'admin');
                      console.log('[Salary] ✅ Exit date saved/updated successfully');
                      setError(''); // Clear any previous errors
                    } catch (err: any) {
                      console.error('[Salary] Could not save exit date:', err.response?.data?.message || err.message);
                      setError(`Failed to save exit date: ${err.response?.data?.message || err.message}`);
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Salary Overview */}
      {!selectedEmployee ? (
        <div className="py-20 flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="w-20 h-20 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-xl">
            <UserSearch className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight mb-2">Personnel Selection Required</h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Please search and select an employee from the dropdown above to generate financial disbursement metrics.
          </p>
        </div>
      ) : (
        <>
          {loading && <LoadingSpinner />}
          {error && <ErrorMessage message={error} onRetry={fetchSalary} />}
          
          {!loading && !error && salary && (
            <div className="animate-fade-in space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Contractual Base', val: salary.baseSalary, grad: 'from-indigo-500/20' },
                  { label: 'Gross Salary', val: salary.grossSalary, grad: 'from-violet-500/20' },
                  { label: 'Net Salary', val: salary.netSalary, grad: 'from-emerald-500/20' },
                ].map((stat, idx) => (
                  <div key={idx} className={`p-8 rounded-[32px] bg-gradient-to-br ${stat.grad} to-transparent border border-white/5 backdrop-blur-xl shadow-2xl`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                    <p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(stat.val)}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Attendance Factor Analysis">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4">
                    {[
                      { label: 'Calendar Units', val: salary.attendance.totalDays, unit: 'days' },
                      { label: 'Expected Cycle', val: salary.attendance.expectedWorkingDays, unit: 'days' },
                      { label: 'Full Presence', val: salary.attendance.fullDays, unit: 'days' },
                      { label: 'Half Day', val: salary.attendance.halfDays, unit: 'days' },
                      { label: 'Recorded Absence', val: salary.attendance.absentDays, unit: 'days' },
                      { label: 'Late Entries (10+ Min)', val: (salary.attendance as any).lateBy10MinutesDays || 0, unit: 'days' },
                      { label: 'Late Entries (30+ Min)', val: (salary.attendance as any).lateBy30MinutesDays || 0, unit: 'days' },
                      { label: 'Late Entries (Total)', val: salary.attendance.lateDays, unit: 'days' },
                      { label: 'Early Departures', val: salary.attendance.earlyExits, unit: 'days' },
                      { label: 'Sunday Paid Count', val: salary.attendance.sundaysInMonth, unit: 'days' },
                      { label: 'Actual Worked', val: salary.attendance.actualDaysWorked, unit: 'days' },
                      { label: 'Payable Units', val: salary.attendance.totalPayableDays, unit: 'days' },
                      { label: 'Worked Span', val: salary.attendance.totalWorkedHours.toFixed(1), unit: 'hours' },
                      { label: 'Expected Span', val: salary.attendance.expectedHours, unit: 'hours' },
                    ].map((stat, idx) => (
                      <div key={idx}>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className="text-xl font-bold text-white tracking-tight">{stat.val} <span className="text-xs text-slate-500 font-medium">{stat.unit}</span></p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Disbursement Breakdown">
                  <div className="space-y-4">
                    {[
                      { label: 'Daily Yield Rate', val: salary.breakdown.perDayRate, op: 'info' },
                      { label: 'Hourly Yield Rate', val: salary.breakdown.hourlyRate, op: 'info' },
                      { label: 'Sunday Compensation', val: salary.breakdown.sundayPay, op: 'add' },
                      ...(salary.breakdown.incentiveAmount ? [{ label: 'Incentive', val: salary.breakdown.incentiveAmount, op: 'add' }] : []),
                      // Display individual adjustments from adjustmentDetails
                      ...(salary.breakdown.adjustmentDetails && salary.breakdown.adjustmentDetails.length > 0
                        ? salary.breakdown.adjustmentDetails
                            .filter((adj: any) => adj.category !== 'INCENTIVE') // Incentive is already shown separately
                            .map((adj: any) => {
                              const categoryLabels: Record<string, string> = {
                                'T_SHIRT': 'T-Shirt Deduction',
                                'ADVANCE': 'Advance Deduction',
                                'REIMBURSEMENT': 'Reimbursement',
                              };
                              const label = categoryLabels[adj.category] || adj.category;
                              return {
                                label,
                                val: adj.amount,
                                op: adj.type === 'DEDUCTION' ? 'subtract' as const : 'add' as const,
                              };
                            })
                        : []),
                      ...((salary.attendance as any).isOvertimeEnabled && salary.breakdown.overtimeAmount > 0 ? [{ label: 'Overtime Compensation', val: salary.breakdown.overtimeAmount, op: 'add' as const }] : []),
                      ...((salary.breakdown as any).lateDeduction10Minutes > 0 ? [{ label: 'Late Deduction (10+ Min - 25%)', val: (salary.breakdown as any).lateDeduction10Minutes, op: 'sub' as const }] : []),
                      ...((salary.breakdown as any).lateDeduction30Minutes > 0 ? [{ label: 'Late Deduction (30+ Min - 50%)', val: (salary.breakdown as any).lateDeduction30Minutes, op: 'sub' as const }] : []),
                      { label: 'Total Late Deduction', val: salary.breakdown.lateDeduction, op: 'sub' },
                      { label: 'Absence Correction', val: salary.breakdown.absentDeduction, op: 'sub' },
                      { label: 'Partial Correction', val: salary.breakdown.halfDayDeduction, op: 'sub' },
                      ...((salary.breakdown as any).lopDeduction > 0 ? [{ label: 'Loss of Pay (LOP)', val: (salary.breakdown as any).lopDeduction, op: 'sub' as const }] : []),
                      ...((salary.breakdown as any).tdsDeduction > 0 ? [{ label: 'TDS Deduction', val: (salary.breakdown as any).tdsDeduction, op: 'sub' as const }] : []),
                      ...((salary.breakdown as any).professionalTax > 0 ? [{ label: 'Professional Tax', val: (salary.breakdown as any).professionalTax, op: 'sub' as const }] : []),
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{item.label}</span>
                        <span className={`text-sm font-bold ${item.op === 'add' ? 'text-emerald-400' : item.op === 'sub' ? 'text-rose-400' : 'text-white'}`}>
                          {item.op === 'sub' ? '-' : item.op === 'add' ? '+' : ''}{formatCurrency(item.val)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Cumulative Adjustments</span>
                        <span className="text-sm font-black text-white uppercase tracking-widest">Total Deductions</span>
                      </div>
                      <span className="text-xl font-black text-rose-400 tracking-tight">-{formatCurrency(salary.breakdown.totalDeductions)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Finalize Salary Button */}
              <Card title="Salary Finalization">
                <div className="space-y-4">
                  <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white uppercase tracking-widest mb-1">
                          Finalize Salary
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {isFinalized 
                            ? 'Salary has been finalized and is visible to employees'
                            : 'Finalize this salary to make it visible to employees'}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!selectedEmployee || !selectedMonth) return;
                          
                          const confirmed = window.confirm(
                            `Are you sure you want to finalize the salary for employee ${selectedEmployee} for ${selectedMonth}?\n\n` +
                            'Once finalized, employees will be able to view and download this salary.'
                          );
                          
                          if (!confirmed) return;
                          
                          setIsFinalizing(true);
                          try {
                            const response = await api.salary.finalize(
                              parseInt(selectedEmployee),
                              selectedMonth
                            );
                            
                            if (response.data.success) {
                              setIsFinalized(true);
                              alert('Salary finalized successfully!');
                            }
                          } catch (err: any) {
                            console.error('Failed to finalize salary:', err);
                            alert(err.response?.data?.message || 'Failed to finalize salary');
                          } finally {
                            setIsFinalizing(false);
                          }
                        }}
                        disabled={isFinalizing || isFinalized || !selectedEmployee || !selectedMonth}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFinalizing ? 'Finalizing...' : isFinalized ? 'Finalized' : 'Finalize Salary'}
                      </button>
                    </div>
                    {isFinalized && (
                      <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                        ✓ Salary has been finalized. Employees can now view and download this salary.
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Salary Adjustments */}
              <Card title="Salary Adjustments">
                <div className="space-y-6">
                  {/* T-Shirt Deduction */}
                  <div className="space-y-3">
                    <Input
                      type="number"
                      label="T-Shirt Deduction (₹)"
                      value={tShirtDeduction.toString()}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setTShirtDeduction(value);
                      }}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <button
                      onClick={handleTShirtSubmit}
                      disabled={isSavingAdjustment || !selectedEmployee || !selectedMonth || tShirtDeduction <= 0}
                      className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingAdjustment ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Saving...
                        </>
                      ) : (
                        'Save T-Shirt Deduction'
                      )}
                    </button>
                  </div>

                  {/* Reimbursement */}
                  <div className="space-y-3">
                    <Input
                      type="number"
                      label="Reimbursement Amount (₹)"
                      value={reimbursementAmount.toString()}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setReimbursementAmount(value);
                      }}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <Input
                      type="text"
                      label="Reimbursement Reason (Optional)"
                      value={reimbursementReason}
                      onChange={(e) => setReimbursementReason(e.target.value)}
                      placeholder="Enter reason for reimbursement"
                    />
                    <button
                      onClick={handleReimbursementSubmit}
                      disabled={isSavingAdjustment || !selectedEmployee || !selectedMonth || reimbursementAmount <= 0}
                      className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingAdjustment ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Saving...
                        </>
                      ) : (
                        'Save Reimbursement'
                      )}
                    </button>
                  </div>

                  {/* Incentive */}
                  <div className="space-y-3">
                    <Input
                      type="number"
                      label="Incentive (₹)"
                      value={incentiveAmount.toString()}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setIncentiveAmount(value);
                      }}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <button
                      onClick={handleIncentiveSubmit}
                      disabled={isSavingAdjustment || !selectedEmployee || !selectedMonth || incentiveAmount <= 0}
                      className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-violet-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingAdjustment ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Saving...
                        </>
                      ) : (
                        'Save Incentive'
                      )}
                    </button>
                  </div>

                  {/* Advance */}
                  <div className="space-y-3">
                    <Input
                      type="number"
                      label="Advance (₹)"
                      value={advanceAmount.toString()}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setAdvanceAmount(value);
                      }}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                    <button
                      onClick={handleAdvanceSubmit}
                      disabled={isSavingAdjustment || !selectedEmployee || !selectedMonth || advanceAmount <= 0}
                      className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSavingAdjustment ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Saving...
                        </>
                      ) : (
                        'Save Advance Deduction'
                      )}
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
      {/* Batch Results */}
      {batchSalaries.length > 0 && (
        <Card title="Batch Calculation Metrics">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Entity</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Contractual Base</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Presence</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Adjustments</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Disbursement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {batchSalaries.map((sal) => (
                  <tr key={sal.employeeCode} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="px-2 py-1 rounded bg-white/[0.05] text-[10px] font-bold text-indigo-400 border border-indigo-500/20">#{sal.employeeCode}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">
                      {formatCurrency(sal.baseSalary)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                      {sal.attendance.actualDaysWorked} <span className="text-[10px] text-slate-600 tracking-tighter">DAYS</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-rose-400 font-bold">
                      -{formatCurrency(sal.breakdown.totalDeductions)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-emerald-400 tracking-tight">
                      {formatCurrency(sal.netSalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Paid Leave Modal */}
      {showPaidLeaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[32px] border border-white/10 p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-white mb-2">Paid Leave Approval</h3>
                <p className="text-sm text-slate-400">Select absent dates to approve as paid leave (Full Day Salary)</p>
              </div>
              <button
                onClick={() => setShowPaidLeaveModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {getAbsentDates().length === 0 ? (
                <p className="text-slate-500 text-center py-8 col-span-2">No absent dates found for this period</p>
              ) : (
                getAbsentDates().map((date) => {
                  const dateStatus = getDateStatus(date);
                  const leaveItem = paidLeaveDates.find(d => d.date === date);
                  const isSelected = !!leaveItem;
                  return (
                    <div
                      key={date}
                      className={`p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handlePaidLeaveDateToggle(date, leaveItem?.value || 1.0)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          {dateStatus && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              dateStatus === 'absent' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {dateStatus === 'absent' ? 'ABSENT' : 'HALF-DAY'}
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              PAID ({leaveItem?.value === 0.5 ? '0.5' : '1.0'} day)
                            </span>
                          )}
                        </div>
                      </label>
                      {isSelected && (
                        <div className="mt-2 ml-6 flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`paid-${date}`}
                              checked={leaveItem?.value === 0.5}
                              onChange={() => handleLeaveValueChange(date, 'paid', 0.5)}
                              className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-slate-300">Half Day (0.5)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`paid-${date}`}
                              checked={leaveItem?.value === 1.0}
                              onChange={() => handleLeaveValueChange(date, 'paid', 1.0)}
                              className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-slate-300">Full Day (1.0)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPaidLeaveModal(false)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Casual Leave Modal */}
      {showCasualLeaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[32px] border border-white/10 p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-white mb-2">Casual Leave Approval</h3>
                <p className="text-sm text-slate-400">Select absent dates to approve as casual leave (Half Day Salary)</p>
              </div>
              <button
                onClick={() => setShowCasualLeaveModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {getAbsentDates().length === 0 ? (
                <p className="text-slate-500 text-center py-8 col-span-2">No absent dates found for this period</p>
              ) : (
                getAbsentDates().map((date) => {
                  const dateStatus = getDateStatus(date);
                  const leaveItem = casualLeaveDates.find(d => d.date === date);
                  const isSelected = !!leaveItem;
                  return (
                    <div
                      key={date}
                      className={`p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCasualLeaveDateToggle(date, leaveItem?.value || 0.5)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          {dateStatus && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              dateStatus === 'absent' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {dateStatus === 'absent' ? 'ABSENT' : 'HALF-DAY'}
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                              CASUAL ({leaveItem?.value === 1.0 ? '1.0' : '0.5'} day)
                            </span>
                          )}
                        </div>
                      </label>
                      {isSelected && (
                        <div className="mt-2 ml-6 flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`casual-${date}`}
                              checked={leaveItem?.value === 0.5}
                              onChange={() => handleLeaveValueChange(date, 'casual', 0.5)}
                              className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-slate-300">Half Day (0.5)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`casual-${date}`}
                              checked={leaveItem?.value === 1.0}
                              onChange={() => handleLeaveValueChange(date, 'casual', 1.0)}
                              className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-slate-300">Full Day (1.0)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCasualLeaveModal(false)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Regularization Modal */}
      {showRegularizationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[32px] border border-white/10 p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-white mb-2">Attendance Regularization</h3>
                <p className="text-sm text-slate-400">Convert Absent/Half-Day to Full Day (Present)</p>
              </div>
              <button
                onClick={() => setShowRegularizationModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            {/* Reason input */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-400 mb-2">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={regularizationReason}
                onChange={(e) => setRegularizationReason(e.target.value)}
                placeholder="e.g., Work from home, Client meeting, etc."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {getRegularizableDates().length === 0 ? (
                <p className="text-slate-500 text-center py-8 col-span-2">No absent or half-day dates found for regularization</p>
              ) : (
                getRegularizableDates().map((date) => {
                  const dateStatus = getDateStatus(date);
                  const regItem = regularizedDates.find(d => d.date === date);
                  const isSelected = !!regItem;
                  return (
                    <div
                      key={date}
                      className={`p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRegularizationToggle(date, regItem?.value || 1.0)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          {dateStatus && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              dateStatus === 'absent' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {dateStatus === 'absent' ? 'ABSENT' : 'HALF-DAY'}
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                              REG ({regItem?.value === 0.5 ? '0.5' : '1.0'} day)
                            </span>
                          )}
                        </div>
                      </label>
                      {isSelected && (
                        <div className="mt-2 ml-6 flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`reg-${date}`}
                              checked={regItem?.value === 0.5}
                              onChange={() => handleRegularizationValueChange(date, 0.5)}
                              className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-slate-300">Half Day (0.5)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`reg-${date}`}
                              checked={regItem?.value === 1.0}
                              onChange={() => handleRegularizationValueChange(date, 1.0)}
                              className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-slate-300">Full Day (1.0)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={async () => {
                  // Save regularizations when Done is clicked
                  if (regularizedDates.length > 0 || regularizationLoadedFromDB) {
                    await saveRegularizations();
                    // Small delay to ensure DB write is complete
                    await new Promise(resolve => setTimeout(resolve, 300));
                    // Reload regularizations from DB to ensure sync
                    await loadPersistedRegularizations();
                    // Small delay to ensure state is updated
                    await new Promise(resolve => setTimeout(resolve, 200));
                    // Recalculate salary after saving (backend will fetch regularizations from DB)
                    await fetchAttendanceBreakdown(); // Refresh attendance first
                    await fetchSalary(); // Then recalculate salary
                  }
                  setShowRegularizationModal(false);
                  setRegularizationReason(''); // Clear reason when closing
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSavingRegularization}
              >
                {isSavingRegularization ? 'Saving...' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

