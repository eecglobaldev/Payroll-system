import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Card from '@/components/UI/Card';
import Badge from '@/components/UI/Badge';
import Input from '@/components/UI/Input';
import SearchableSelect from '@/components/UI/SearchableSelect';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { api } from '@/lib/api';
import { formatDate, formatTime, formatHours, getCurrentMonth } from '@/utils/format';
import { ATTENDANCE_STATUS_LABELS } from '@/utils/constants';
import type { Employee, AttendanceSummary } from '@/types';

export default function Attendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [rawLogs, setRawLogs] = useState<Record<string, any[]>>({});
  const [isSplitShift, setIsSplitShift] = useState(false);
  const [, setLoadingLogs] = useState(false); // Used for split shift log loading
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isGeneratingBranchPDF, setIsGeneratingBranchPDF] = useState(false);
  const [branchPDFProgress, setBranchPDFProgress] = useState<{ current: number; total: number } | null>(null);
  
  const selectedEmployee = searchParams.get('employee') || '';
  const selectedMonth = searchParams.get('month') || getCurrentMonth();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchAttendance();
    }
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    try {
      const response = await api.employees.getAll();
      const employeeList = response.data.data || [];
      setEmployees(employeeList);
    } catch (err: any) {
      setError('Failed to load employees');
    }
  };

  const fetchAttendance = async () => {
    if (!selectedEmployee) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userId = parseInt(selectedEmployee);
      const response = await api.attendance.getSummary(userId, selectedMonth);
      const attendanceData = response.data.data || null;
      setAttendance(attendanceData);
      
      // Check if this is a split shift employee (any day with more than 2 logs)
      const hasSplitShift = attendanceData?.dailyBreakdown?.some(day => day.logCount > 2) || false;
      setIsSplitShift(hasSplitShift);
      
      // If split shift, fetch raw logs for ALL days to show in 4 columns consistently
      if (hasSplitShift && attendanceData?.dailyBreakdown) {
        setLoadingLogs(true);
        const logsMap: Record<string, any[]> = {};
        
        // Fetch logs for all days (not just days with > 2 logs)
        for (const day of attendanceData.dailyBreakdown) {
          // Skip weekoffs and not-active days
          if (day.status === 'weekoff' || day.status === 'not-active') continue;
          
          try {
            const logsResponse = await api.attendance.getRawLogs(userId, day.date);
            if (logsResponse.data?.data?.logs) {
              logsMap[day.date] = logsResponse.data.data.logs;
            }
          } catch (err) {
            console.error(`Failed to fetch logs for ${day.date}:`, err);
          }
        }
        
        setRawLogs(logsMap);
        setLoadingLogs(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (employeeNo: string) => {
    setSearchParams({ employee: employeeNo, month: selectedMonth });
  };

  const handleMonthChange = (month: string) => {
    setSearchParams({ employee: selectedEmployee, month });
  };

  // Calculate max date for custom end date (last day of selected month)
  const getMaxDate = () => {
    if (!selectedMonth) return undefined;
    const [year, month] = selectedMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    return `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;
  };

  const selectedEmployeeData = employees.find(e => e.employeeNo === selectedEmployee);

  // Get unique branches from employees
  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    employees.forEach(emp => {
      if (emp.location && emp.location !== 'N/A') {
        branches.add(emp.location);
      }
    });
    return Array.from(branches).sort();
  }, [employees]);

  // Filter employees based on selected branch
  const filteredEmployees = useMemo(() => {
    if (!selectedBranch) return employees;
    return employees.filter(emp => emp.location === selectedBranch);
  }, [employees, selectedBranch]);

  // Filter attendance data based on custom end date and recalculate weekoff payment status
  const filteredAttendance = useMemo(() => {
    if (!attendance || !customEndDate) return attendance;
    
    const endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date
    
    const filteredDailyBreakdown = attendance.dailyBreakdown.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate <= endDate;
    });
    
    // Count absent days in the filtered period (only actual absent days, not weekoffs)
    const absentDaysInPeriod = filteredDailyBreakdown.filter(d => 
      d.status === 'absent'
    ).length;
    
    // Recalculate weekoff payment status based on filtered period
    // Rule: If 5+ absent days → all weekoffs are unpaid
    // Otherwise: Check sandwich rule (absent on both Saturday and Monday)
    const hasFiveOrMoreLeaveDays = absentDaysInPeriod >= 5;
    
    // Create a map for quick lookup
    const attendanceMap = new Map<string, string>();
    filteredDailyBreakdown.forEach(day => {
      attendanceMap.set(day.date, day.status);
    });
    
    // Update weekoff payment status for filtered dates
    const updatedDailyBreakdown = filteredDailyBreakdown.map(day => {
      if (day.status === 'weekoff') {
        const dayDate = new Date(day.date);
        const dayOfWeek = dayDate.getDay(); // 0 = Sunday
        
        if (dayOfWeek === 0) { // Sunday
          let weekoffType: 'paid' | 'unpaid' = 'paid';
          
          // Rule 1: If 5+ absent days, all weekoffs are unpaid
          if (hasFiveOrMoreLeaveDays) {
            weekoffType = 'unpaid';
          }
           else {
            // Rule 2: Sandwich rule - check Saturday and Monday
            // Only apply if both Saturday and Monday are within the filtered period
            const saturdayDate = new Date(dayDate);
            saturdayDate.setDate(saturdayDate.getDate() - 1);
            const saturdayStr = saturdayDate.toISOString().split('T')[0];
            
            const mondayDate = new Date(dayDate);
            mondayDate.setDate(mondayDate.getDate() + 1);
            const mondayStr = mondayDate.toISOString().split('T')[0];
            
            // Check if Saturday and Monday are within the filtered period
            const saturdayInRange = new Date(saturdayStr) <= endDate;
            const mondayInRange = new Date(mondayStr) <= endDate;
            
            if (saturdayInRange && mondayInRange) {
              const saturdayStatus = attendanceMap.get(saturdayStr);
              const mondayStatus = attendanceMap.get(mondayStr);
              
              // Sunday is unpaid if absent on BOTH Saturday AND Monday
              if (saturdayStatus === 'absent' && mondayStatus === 'absent') {
                weekoffType = 'unpaid';
              }
            }
            // If Saturday or Monday is outside the filtered range, we can't apply sandwich rule
            // So default to paid (conservative approach)
          }
          
          return {
            ...day,
            weekoffType
          };
        }
      }
      return day;
    });
    
    // Recalculate summary based on filtered data
    const filteredSummary = {
      fullDays: updatedDailyBreakdown.filter(d => d.status === 'full-day').length,
      halfDays: updatedDailyBreakdown.filter(d => d.status === 'half-day').length,
      absentDays: updatedDailyBreakdown.filter(d => d.status === 'absent').length,
      lateDays: updatedDailyBreakdown.filter(d => d.isLate).length,
      earlyExits: updatedDailyBreakdown.filter(d => d.isEarlyExit).length,
      totalWorkedHours: updatedDailyBreakdown.reduce((sum, d) => sum + d.totalHours, 0),
    };
    
    return {
      ...attendance,
      dailyBreakdown: updatedDailyBreakdown,
      summary: filteredSummary,
    };
  }, [attendance, customEndDate, selectedMonth]);

  // Helper function to generate attendance table for a single employee
  const generateEmployeeAttendanceTable = (
    doc: jsPDF,
    employee: Employee,
    attendanceData: AttendanceSummary,
    startY: number,
    branchName?: string
  ): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Check if we need a new page
    if (startY > pageHeight - 80) {
      doc.addPage();
      startY = 20;
    }

    // Employee header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, startY, pageWidth - 14, startY);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY ATTENDANCE RECORD', pageWidth / 2, startY - 5, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const employeeInfo = `Daily Attendance of: ${employee.employeeNo} - ${employee.name}${branchName ? ` (Branch: ${branchName})` : employee.location ? ` (Branch: ${employee.location})` : ''}`;
    doc.text(employeeInfo, 14, startY + 8);

    // Process attendance data
    const tableData = attendanceData.dailyBreakdown.map(day => {
      const date = new Date(day.date);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const firstEntry = day.firstEntry ? new Date(day.firstEntry).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const lastExit = day.lastExit ? new Date(day.lastExit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const hours = day.totalHours.toFixed(2);
      const status = day.status.toUpperCase();
      
      const isRegularized = (day as any).isRegularized || false;
      let leaveStatus = '';
      if (isRegularized) {
        const originalStatus = (day as any).originalStatus || (day.status === 'full-day' ? 'absent' : day.status);
        leaveStatus = `REG (${originalStatus.toUpperCase()})`;
      } else if ((day as any).paidLeave) {
        leaveStatus = 'PAID LEAVE';
      } else if ((day as any).casualLeave) {
        leaveStatus = 'CASUAL LEAVE';
      } else if (day.status === 'weekoff') {
        const weekoffType = day.weekoffType || (day as any).weekoffType;
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
      if ((day as any).paidLeave) {
        attendanceValue = '1';
      } else if (isRegularized) {
        attendanceValue = '1';
      } else if ((day as any).casualLeave) {
        const originalStatus = (day as any).originalStatus || day.status;
        if (originalStatus === 'half-day') {
          attendanceValue = '1';
        } else if (originalStatus === 'absent') {
          attendanceValue = '0.5';
        } else {
          attendanceValue = '0.5';
        }
      } else if (day.status === 'full-day') {
        attendanceValue = '1';
      } else if (day.status === 'half-day') {
        attendanceValue = '0.5';
      } else if (day.status === 'absent') {
        attendanceValue = '0';
      } else if (day.status === 'weekoff') {
        const weekoffType = day.weekoffType || (day as any).weekoffType;
        attendanceValue = weekoffType === 'paid' ? '1' : '0';
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
          flags || '-',
          leaveStatus || '-',
          attendanceValue,
        ],
        value: parseFloat(attendanceValue)
      };
    });
    
    const totalValue = tableData.reduce((sum, item) => sum + item.value, 0);
    const tableBody = tableData.map(item => item.row);
    
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
      startY: startY + 15,
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
          data.cell.styles.fillColor = [255, 255, 255];
        }
      },
      margin: { left: 14, right: 14 }
    });

    return (doc as any).lastAutoTable.finalY + 10;
  };

  // Download PDF for branch (all employees in selected branch)
  const downloadBranchPDF = async () => {
    if (!selectedBranch) return;

    setIsGeneratingBranchPDF(true);
    setBranchPDFProgress({ current: 0, total: 0 });

    try {
      // Get all employees from selected branch
      const branchEmployees = filteredEmployees.filter(emp => emp.location === selectedBranch);
      
      if (branchEmployees.length === 0) {
        alert('No employees found in the selected branch.');
        return;
      }

      setBranchPDFProgress({ current: 0, total: branchEmployees.length });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Batch processing configuration
      const BATCH_SIZE = 3; // Process 3 employees at a time
      const DELAY_BETWEEN_BATCHES = 500; // 500ms delay between batches
      const DELAY_BETWEEN_REQUESTS = 200; // 200ms delay between individual requests

      let currentY = 20;
      let processedCount = 0;

      // Process employees in batches
      for (let i = 0; i < branchEmployees.length; i += BATCH_SIZE) {
        const batch = branchEmployees.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel with throttling
        const batchPromises = batch.map(async (employee, batchIndex) => {
          // Add delay between requests within batch
          if (batchIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }

          try {
            const userId = parseInt(employee.employeeNo);
            if (isNaN(userId)) {
              console.warn(`[Branch PDF] Invalid employee number: ${employee.employeeNo}`);
              return null;
            }

            // Fetch attendance breakdown for this employee
            const response = await api.attendance.getSummary(userId, selectedMonth);
            const attendanceData = response.data.data;

            if (!attendanceData || !attendanceData.dailyBreakdown) {
              console.warn(`[Branch PDF] No attendance data for employee ${employee.employeeNo}`);
              return null;
            }

            // Apply custom end date filter if set
            let filteredBreakdown = attendanceData.dailyBreakdown;
            if (customEndDate) {
              const endDateFilter = new Date(customEndDate);
              endDateFilter.setHours(23, 59, 59, 999);
              filteredBreakdown = attendanceData.dailyBreakdown.filter(day => {
                const dayDate = new Date(day.date);
                return dayDate <= endDateFilter;
              });
            }

            return {
              employee,
              attendance: {
                ...attendanceData,
                dailyBreakdown: filteredBreakdown
              }
            };
          } catch (err: any) {
            console.error(`[Branch PDF] Failed to fetch attendance for ${employee.employeeNo}:`, err);
            return null;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Generate PDF sections for successful results
        for (const result of batchResults) {
          if (result) {
            currentY = generateEmployeeAttendanceTable(doc, result.employee, result.attendance, currentY, selectedBranch);
            processedCount++;
            setBranchPDFProgress({ current: processedCount, total: branchEmployees.length });
          }
        }

        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < branchEmployees.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      // Add footer to all pages
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
      const branchName = selectedBranch.replace(/\s+/g, '_');
      const fileName = `Attendance_Report_Branch_${branchName}_${selectedMonth}${customEndDate ? `_to_${customEndDate}` : ''}.pdf`;
      doc.save(fileName);

      console.log(`[Branch PDF] ✅ Generated PDF for ${processedCount} employees from branch: ${selectedBranch}`);
    } catch (err: any) {
      console.error('[Branch PDF] Error generating branch PDF:', err);
      alert('Failed to generate branch PDF. Please try again.');
    } finally {
      setIsGeneratingBranchPDF(false);
      setBranchPDFProgress(null);
    }
  };

  const downloadPDF = () => {
    // If branch is selected but no employee, generate branch PDF
    if (selectedBranch && !selectedEmployee) {
      downloadBranchPDF();
      return;
    }

    // Otherwise, generate single employee PDF
    if (!filteredAttendance || !selectedEmployeeData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header (minimal ink - matching Salary page format)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, 20, pageWidth - 14, 20);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY ATTENDANCE RECORD', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const branchInfo = selectedEmployeeData.location ? ` (Branch: ${selectedEmployeeData.location})` : '';
    doc.text(`Daily Attendance of: ${selectedEmployeeData.employeeNo}${branchInfo}`, 14, 28);

    // Daily Attendance Record Table (matching Salary page format)
    const attendanceData = filteredAttendance.dailyBreakdown.map(day => {
      const date = new Date(day.date);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const firstEntry = day.firstEntry ? new Date(day.firstEntry).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const lastExit = day.lastExit ? new Date(day.lastExit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const hours = day.totalHours.toFixed(2);
      const status = day.status.toUpperCase();
      
      // Check if this date has approved leave, regularization, or weekoff payment status
      const isRegularized = (day as any).isRegularized || false;
      let leaveStatus = '';
      if (isRegularized) {
        const originalStatus = (day as any).originalStatus || (day.status === 'full-day' ? 'absent' : day.status);
        leaveStatus = `REG (${originalStatus.toUpperCase()})`;
      } else if ((day as any).paidLeave) {
        leaveStatus = 'PAID LEAVE';
      } else if ((day as any).casualLeave) {
        leaveStatus = 'CASUAL LEAVE';
      } else if (day.status === 'weekoff') {
        const weekoffType = day.weekoffType || (day as any).weekoffType;
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
      
      // Calculate attendance value
      let attendanceValue = '0';
      
      // Check if it's a paid leave first (overrides other statuses)
      if ((day as any).paidLeave) {
        attendanceValue = '1';
      } else if (isRegularized) {
        attendanceValue = '1';
      } else if ((day as any).casualLeave) {
        const originalStatus = (day as any).originalStatus || day.status;
        if (originalStatus === 'half-day') {
          attendanceValue = '1';
        } else if (originalStatus === 'absent') {
          attendanceValue = '0.5';
        } else {
          attendanceValue = '0.5';
        }
      } else if (day.status === 'full-day') {
        attendanceValue = '1';
      } else if (day.status === 'half-day') {
        attendanceValue = '0.5';
      } else if (day.status === 'absent') {
        attendanceValue = '0';
      } else if (day.status === 'weekoff') {
        const weekoffType = day.weekoffType || (day as any).weekoffType;
        attendanceValue = weekoffType === 'paid' ? '1' : '0';
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
          flags || '-',
          leaveStatus || '-',
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
          data.cell.styles.fillColor = [255, 255, 255];
        }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`Attendance_Report_${selectedEmployeeData.employeeNo}_${selectedMonth}${customEndDate ? `_to_${customEndDate}` : ''}.pdf`);
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-wrap gap-6 items-center justify-between animate-fade-in">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-500 rounded-full" />
            <h1 className="text-4xl font-bold text-white tracking-tight">Attendance</h1>
          </div>
          <p className="text-slate-400 font-medium pl-4">
            Biometric logs and presence monitoring
          </p>
        </div>
        {(filteredAttendance || (selectedBranch && !selectedEmployee)) && (
          <button
            onClick={downloadPDF}
            disabled={isGeneratingBranchPDF}
            className="flex items-center px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingBranchPDF ? (
              <>
                <div className="w-4 h-4 mr-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-3" />
                Download Report (PDF)
              </>
            )}
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SearchableSelect
          label="Branch"
          value={selectedBranch}
          onChange={(value) => {
            setSelectedBranch(value);
            // Clear selected employee when branch changes
            if (selectedEmployee) {
              handleEmployeeChange('');
            }
          }}
          placeholder="Select branch..."
          options={[
            { value: '', label: 'All Branches' },
            ...availableBranches.map(branch => ({
              value: branch,
              label: branch
            }))
          ]}
        />
        <SearchableSelect
          label="Target Personnel"
          value={selectedEmployee}
          onChange={(value) => handleEmployeeChange(value)}
          placeholder="Search and select personnel..."
          options={filteredEmployees.map(emp => ({
            value: emp.employeeNo,
            label: `[#${emp.employeeNo}] ${emp.name}`
          }))}
        />
        <Input
          type="month"
          label="Billing Period"
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
        />
        <Input
          type="date"
          label="Custom End Date (Optional)"
          value={customEndDate}
          onChange={(e) => setCustomEndDate(e.target.value)}
          placeholder="View up to specific date"
          max={getMaxDate()}
        />
      </div>

      {!selectedEmployee && !isGeneratingBranchPDF ? (
        <div className="py-20 flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="w-20 h-20 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-xl">
            <Search className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight mb-2">
            {selectedBranch ? 'Branch Selected' : 'Operational Context Required'}
          </h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            {selectedBranch 
              ? `Click "Download Report (PDF)" to generate attendance report for all employees in ${selectedBranch}.`
              : 'Please select an employee or branch to visualize biometric logs and presence metrics for the selected billing period.'}
          </p>
        </div>
      ) : (
        <>
          {/* Personnel Context */}
          {selectedEmployeeData && (
            <div className="p-6 rounded-[24px] bg-white/[0.02] border border-white/5 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                  {selectedEmployeeData.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedEmployeeData.name}</h3>
                  <p className="text-sm text-slate-500 font-semibold">{selectedEmployeeData.department} • {selectedEmployeeData.designation}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-center text-indigo-400 text-[10px] font-bold tracking-widest border border-indigo-500/20 uppercase">Personnel Ref #{selectedEmployeeData.employeeNo}</span>
            </div>
          )}

      {/* Branch PDF Generation Progress */}
      {isGeneratingBranchPDF && branchPDFProgress && (
        <div className="py-20 flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="w-20 h-20 rounded-[32px] bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-xl">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight mb-2">Generating Branch Attendance Report</h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed mb-4">
            Fetching attendance data for all employees in {selectedBranch}...
          </p>
          <p className="text-sm text-slate-400 mb-4">
            Processing {branchPDFProgress.current} of {branchPDFProgress.total} employees
          </p>
          <div className="w-full max-w-md">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(branchPDFProgress.current / branchPDFProgress.total) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            This may take a few moments. Please do not close this page.
          </p>
        </div>
      )}

      {/* Analytics Summary */}
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={fetchAttendance} />}
      
      {!loading && !error && filteredAttendance && !isGeneratingBranchPDF && (
            <div className="animate-fade-in space-y-10">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {[
                  { label: 'Standard Shifts', val: filteredAttendance.summary.fullDays, color: 'text-emerald-400' },
                  { label: 'Partial Presence', val: filteredAttendance.summary.halfDays, color: 'text-amber-400' },
                  { label: 'Absence Events', val: filteredAttendance.summary.absentDays, color: 'text-rose-400' },
                  { label: 'Late Entries', val: filteredAttendance.summary.lateDays, color: 'text-orange-400' },
                  { label: 'Premature Exits', val: filteredAttendance.summary.earlyExits, color: 'text-indigo-400' },
                  { label: 'Aggregate Hours', val: filteredAttendance.summary.totalWorkedHours.toFixed(1), color: 'text-violet-400' },
                ].map((stat, idx) => (
                  <div key={idx} className="glass-card p-6 rounded-[20px] text-center border-white/[0.03]">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.val}</p>
                  </div>
                ))}
              </div>

              {/* Ledger Breakdown */}
              <Card title="Operational Attendance Ledger">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Timestamp</th>
                        {isSplitShift ? (
                          <>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Entry 1</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Entry 2</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Entry 3</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Entry 4</th>
                          </>
                        ) : (
                          <>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">First In</th>
                            <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Last Out</th>
                          </>
                        )}
                        <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Duration</th>
                        <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Status</th>
                        <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {filteredAttendance.dailyBreakdown.map((day) => {
                        const dayRawLogs = rawLogs[day.date] || [];
                        
                        return (
                          <tr key={day.date} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">
                              {formatDate(day.date, 'dd MMM yyyy')}
                            </td>
                            
                            {isSplitShift ? (
                              // Show 4 entry columns for split shift
                              <>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {dayRawLogs[0] ? dayRawLogs[0].time : '—'}
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {dayRawLogs[1] ? dayRawLogs[1].time : '—'}
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {dayRawLogs[2] ? dayRawLogs[2].time : '—'}
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {dayRawLogs[3] ? dayRawLogs[3].time : '—'}
                                </td>
                              </>
                            ) : (
                              // Show First In and Last Out for normal shift
                              <>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {day.firstEntry ? formatTime(day.firstEntry) : '—'}
                                </td>
                                <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">
                                  {day.lastExit ? formatTime(day.lastExit) : '—'}
                                </td>
                              </>
                            )}
                            
                            <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">
                              {day.totalHours > 0 ? formatHours(day.totalHours) : '—'}
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  day.status === 'full-day' ? 'success' : 
                                  day.status === 'half-day' ? 'warning' : 
                                  day.status === 'not-active' ? 'default' : 
                                  day.status === 'weekoff' ? 'info' : 
                                  'danger'
                                }>
                                  {ATTENDANCE_STATUS_LABELS[day.status]}
                                </Badge>
                                {day.status === 'weekoff' && day.weekoffType && (
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                    day.weekoffType === 'paid' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>
                                    {day.weekoffType === 'paid' ? 'Paid' : 'Unpaid'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="flex gap-2">
                                {day.isLate && <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">Late</span>}
                                {day.isEarlyExit && <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">Early Exit</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

