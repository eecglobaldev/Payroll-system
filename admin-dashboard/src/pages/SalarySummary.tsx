import { useEffect, useState } from 'react';
import { Download, Calendar, Loader2, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import Card from '@/components/UI/Card';
import Input from '@/components/UI/Input';
import SearchableMultiSelect from '@/components/UI/SearchableMultiSelect';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonth } from '@/utils/format';
import type { SalaryCalculation } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface SalarySummaryData {
  totalEmployees: number;
  processed: number;
  failed: number;
  data: SalaryCalculation[];
  totalNetSalary: number;
  errors?: Array<{ employeeCode: string; error: string }>;
}

export default function SalarySummary() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [summaryData, setSummaryData] = useState<SalarySummaryData | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [generatingAttendance, setGeneratingAttendance] = useState(false);
  const [attendanceProgress, setAttendanceProgress] = useState<{ current: number; total: number } | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.employees.getAll();
      const employeeList = response.data.data || [];
      setEmployees(employeeList);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    }
  };

  const fetchSalarySummary = async () => {
    setLoading(true);
    setError(null);
    setSummaryData(null);
    setProgress(null);

    try {
      // Show progress indicator
      setProgress({ current: 0, total: 0 });

      console.log(`[SalarySummary] 🔄 Fetching salary data for month: ${selectedMonth}`);
      const response = await api.salary.getSummary(selectedMonth, 10); // Process 10 at a time
      
      // The backend returns: { success: true, month, totalEmployees, processed, failed, data: [...], totalNetSalary, errors }
      // Axios wraps it in response.data, so response.data IS the backend response object directly
      // Note: TDS and Professional Tax are automatically excluded when gross salary is 0 (handled in payroll.ts)
      const summaryData = response.data as any;
      
      console.log('[SalarySummary] 📊 API Response:', {
        month: summaryData.month,
        totalEmployees: summaryData.totalEmployees,
        processed: summaryData.processed,
        sampleEmployee: summaryData.data?.[0],
      });
      
      if (summaryData && summaryData.success !== false) {
        let salaryData = Array.isArray(summaryData.data) ? summaryData.data : [];
        
        // Filter by branch if selected
        if (selectedBranch.length > 0 && !selectedBranch.includes('')) {
          // Create a map of employee codes to locations
          const employeeLocationMap = new Map<string, string>();
          employees.forEach(emp => {
            employeeLocationMap.set(emp.employeeNo, emp.location);
          });
          
          // Filter salary data by selected branches
          salaryData = salaryData.filter((salary: SalaryCalculation) => {
            const location = employeeLocationMap.get(salary.employeeCode);
            return location && selectedBranch.includes(location);
          });
          
          // Recalculate totals for filtered data
          const filteredTotalNetSalary = salaryData.reduce((sum: number, s: SalaryCalculation) => sum + s.netSalary, 0);
          
          const safeData: SalarySummaryData = {
            totalEmployees: salaryData.length,
            processed: salaryData.length,
            failed: 0,
            data: salaryData,
            totalNetSalary: filteredTotalNetSalary,
            errors: summaryData.errors?.filter((err: any) => {
              const location = employeeLocationMap.get(err.employeeCode);
              return location && selectedBranch.includes(location);
            }) || [],
          };
          setSummaryData(safeData);
          console.log(`[SalarySummary] ✅ Loaded ${safeData.processed} salaries for ${selectedMonth} (filtered by branches: ${selectedBranch.join(', ')})`);
        } else {
          const safeData: SalarySummaryData = {
            totalEmployees: summaryData.totalEmployees || 0,
            processed: summaryData.processed || 0,
            failed: summaryData.failed || 0,
            data: salaryData,
            totalNetSalary: summaryData.totalNetSalary || 0,
            errors: summaryData.errors,
          };
          setSummaryData(safeData);
          console.log(`[SalarySummary] ✅ Loaded ${safeData.processed} salaries for ${selectedMonth}`);
        }
        console.log('[SalarySummary] 💰 Sample salary data:', salaryData.slice(0, 3));
      } else {
        // Set empty state if no data
        setSummaryData({
          totalEmployees: 0,
          processed: 0,
          failed: 0,
          data: [],
          totalNetSalary: 0,
        });
        console.warn('[SalarySummary] ⚠️ No data received or request failed');
      }
    } catch (err: any) {
      console.error('Failed to fetch salary summary:', err);
      setError(err.response?.data?.message || 'Failed to load salary summary');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleDownloadPDF = () => {
    if (!summaryData || !summaryData.data || summaryData.data.length === 0) return;

    // Use landscape orientation for better table width
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper function to format currency for PDF
    const formatPdfCurrency = (amount: number): string => {
      return 'Rs. ' + amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, 35, pageWidth - 14, 35);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SALARY SUMMARY REPORT', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const monthDate = new Date(selectedMonth + '-01');
    doc.text(
      `Month: ${monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
      pageWidth / 2,
      28,
      { align: 'center' }
    );
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      pageWidth / 2,
      33,
      { align: 'center' }
    );

    // Prepare table data with all columns
    const tableData = (summaryData.data || []).map((salary) => {
      // Calculate additions (incentive + adjustment additions)
      const additions = (salary.breakdown.incentiveAmount || 0) + (salary.breakdown.adjustmentAdditions || 0);
      
      return [
        salary.employeeCode || 'N/A',
        (salary as any).employeeName || salary.employeeCode || 'Unknown',
        `${salary.attendance.fullDays || 0}`, // Present Days
        `${salary.attendance.halfDays || 0}`, // Half Days
        `${salary.attendance.sundaysInMonth || 0}`, // WO (Week Off - paid Sundays)
        `${(salary.attendance.totalPayableDays || 0).toFixed(1)}`, // Payable Days
        `${salary.attendance.absentDays || 0}`, // LOP (Loss of Pay)
        formatPdfCurrency(salary.baseSalary),
        formatPdfCurrency(salary.grossSalary),
        formatPdfCurrency(salary.breakdown.totalDeductions),
        formatPdfCurrency(additions > 0 ? additions : 0), // Additions
        formatPdfCurrency(salary.netSalary),
      ];
    });

    // Add total row
    const totals = summaryData.data.reduce((acc, salary) => {
      const additions = (salary.breakdown.incentiveAmount || 0) + (salary.breakdown.adjustmentAdditions || 0);
      return {
        presentDays: acc.presentDays + (salary.attendance.fullDays || 0),
        halfDays: acc.halfDays + (salary.attendance.halfDays || 0),
        wo: acc.wo + (salary.attendance.sundaysInMonth || 0),
        payableDays: acc.payableDays + (salary.attendance.totalPayableDays || 0),
        lop: acc.lop + (salary.attendance.absentDays || 0),
        baseSalary: acc.baseSalary + salary.baseSalary,
        grossSalary: acc.grossSalary + salary.grossSalary,
        deductions: acc.deductions + salary.breakdown.totalDeductions,
        additions: acc.additions + additions,
        netSalary: acc.netSalary + salary.netSalary,
      };
    }, {
      presentDays: 0,
      halfDays: 0,
      wo: 0,
      payableDays: 0,
      lop: 0,
      baseSalary: 0,
      grossSalary: 0,
      deductions: 0,
      additions: 0,
      netSalary: 0,
    });

    tableData.push([
      'TOTAL',
      `${summaryData.processed} Employees`,
      `${totals.presentDays}`,
      `${totals.halfDays}`,
      `${totals.wo}`,
      `${totals.payableDays.toFixed(1)}`,
      `${totals.lop}`,
      formatPdfCurrency(totals.baseSalary),
      formatPdfCurrency(totals.grossSalary),
      formatPdfCurrency(totals.deductions),
      formatPdfCurrency(totals.additions),
      formatPdfCurrency(summaryData.totalNetSalary),
    ]);

    // Calculate available width for table (page width - margins)
    const leftMargin = 14;
    const rightMargin = 14;
    const availableWidth = pageWidth - leftMargin - rightMargin;
    
    // Calculate column widths as percentages of available width
    // Adjusted for more columns: Code: 6%, Name: 12%, Present: 4%, Half: 4%, WO: 3%, Payable: 5%, LOP: 4%, Base: 8%, Gross: 8%, Deductions: 8%, Additions: 8%, Net: 8%
    const columnWidths = [
      availableWidth * 0.06,  // Employee Code
      availableWidth * 0.12,  // Name
      availableWidth * 0.04,  // Present Days
      availableWidth * 0.04,  // Half Days
      availableWidth * 0.03,  // WO
      availableWidth * 0.05,  // Payable Days
      availableWidth * 0.04,  // LOP
      availableWidth * 0.08,  // Base Salary
      availableWidth * 0.08,  // Gross Salary
      availableWidth * 0.08,  // Deductions
      availableWidth * 0.08,  // Additions
      availableWidth * 0.08,  // Net Salary
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Code', 'Name', 'Present', 'Half', 'WO', 'Payable', 'LOP', 'Base', 'Gross', 'Deductions', 'Additions', 'Net']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 6,
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
        textColor: [0, 0, 0],
        cellPadding: 1.5,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: function (data: any) {
        // Style the total row (last row)
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.lineWidth = 0.5;
          data.cell.styles.lineColor = [0, 0, 0];
          data.cell.styles.textColor = [0, 0, 0];
        }
      },
      columnStyles: {
        0: { cellWidth: columnWidths[0], halign: 'center' }, // Code
        1: { cellWidth: columnWidths[1], halign: 'left' }, // Name
        2: { cellWidth: columnWidths[2], halign: 'center' }, // Present
        3: { cellWidth: columnWidths[3], halign: 'center' }, // Half
        4: { cellWidth: columnWidths[4], halign: 'center' }, // WO
        5: { cellWidth: columnWidths[5], halign: 'center' }, // Payable
        6: { cellWidth: columnWidths[6], halign: 'center' }, // LOP
        7: { cellWidth: columnWidths[7], halign: 'right' }, // Base
        8: { cellWidth: columnWidths[8], halign: 'right' }, // Gross
        9: { cellWidth: columnWidths[9], halign: 'right' }, // Deductions
        10: { cellWidth: columnWidths[10], halign: 'right' }, // Additions
        11: { cellWidth: columnWidths[11], halign: 'right', fontStyle: 'bold' }, // Net
      },
      margin: { left: leftMargin, right: rightMargin },
      tableWidth: 'auto',
    });

    // Summary statistics
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check if we need a new page for summary stats
    if (finalY > pageHeight - 40) {
      doc.addPage();
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SALARY SUMMARY REPORT', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Month: ${monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
        pageWidth / 2,
        28,
        { align: 'center' }
      );
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', leftMargin, finalY > pageHeight - 40 ? 35 : finalY);

    const statsData = [
      ['Total Employees', `${summaryData.totalEmployees}`],
      ['Successfully Processed', `${summaryData.processed}`],
      ['Failed', `${summaryData.failed}`],
      ['Total Net Salary', formatPdfCurrency(summaryData.totalNetSalary)],
    ];

    autoTable(doc, {
      startY: finalY > pageHeight - 40 ? 40 : finalY + 5,
      head: [['Metric', 'Value']],
      body: statsData,
      theme: 'plain',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
        cellPadding: 3,
        fontSize: 8,
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
        cellPadding: 3,
        fontSize: 8,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: availableWidth * 0.6 },
        1: { halign: 'right', cellWidth: availableWidth * 0.4 },
      },
      margin: { left: leftMargin, right: rightMargin },
      tableWidth: 'auto',
    });

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    const monthDateStr = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const fileName = `Salary_Summary_${monthDateStr.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  };

  const handleDownloadAttendanceReport = async () => {
    if (!summaryData || !summaryData.data || summaryData.data.length === 0) return;

    setGeneratingAttendance(true);
    setAttendanceProgress({ current: 0, total: summaryData.data.length });

    try {
      // Helper function to get last 10 working days
      // Note: getLast10WorkingDays has been moved to the backend API
      // The backend now calculates the last 10 working days from today
      // via the /api/salary/:userId/recent-attendance endpoint

      // Analyze attendance pattern for prediction
      const analyzePrediction = (recentAttendance: any[]) => {
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
          prediction = 'CHECK';
          predictionStatus = 'CHECK';
        } else if (absentPercentage >= ABSENT_PERCENTAGE_THRESHOLD) {
          prediction = 'AT RISK';
          predictionStatus = 'AT_RISK';
        } else if (presentCount === 0 && workingDaysCount > 0) {
          prediction = 'CONCERNING';
          predictionStatus = 'CONCERNING';
        } else {
          prediction = 'ACTIVE';
          predictionStatus = 'ACTIVE';
        }
        
        return { prediction, predictionStatus, absentCount, presentCount, maxConsecutiveAbsents };
      };

      // Fetch attendance for all employees in batches
      const employeeAttendance: Array<{
        employeeCode: string;
        employeeName: string;
        recentDays: any[];
        analysis: any;
      }> = [];
      
      const BATCH_SIZE = 5; // Process 5 employees at a time to prevent server overload
      
      for (let i = 0; i < summaryData.data.length; i += BATCH_SIZE) {
        const batch = summaryData.data.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (salary) => {
          try {
            // Convert employeeCode to userId (they are the same in most cases)
            const userId = parseInt(salary.employeeCode);
            if (isNaN(userId)) {
              throw new Error('Invalid employee code');
            }
            
            // Use the new API endpoint that calculates last 10 working days from today
            const response = await api.salary.getRecentAttendance(userId);
            
            const recentDays = response.data?.data?.recentAttendance || [];
            const analysis = analyzePrediction(recentDays);
            
            return {
              employeeCode: salary.employeeCode,
              employeeName: (salary as any).employeeName || salary.employeeCode,
              recentDays,
              analysis
            };
          } catch (err) {
            console.error(`Failed to fetch attendance for ${salary.employeeCode}:`, err);
            return {
              employeeCode: salary.employeeCode,
              employeeName: (salary as any).employeeName || salary.employeeCode,
              recentDays: [],
              analysis: { prediction: 'ERROR', predictionStatus: 'ERROR', absentCount: 0, presentCount: 0, maxConsecutiveAbsents: 0 }
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        employeeAttendance.push(...batchResults);
        
        // Update progress
        setAttendanceProgress({ current: employeeAttendance.length, total: summaryData.data.length });
        
        // Small delay between batches to prevent overwhelming the server
        if (i + BATCH_SIZE < summaryData.data.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Generate PDF
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(14, 30, pageWidth - 14, 30);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE REPORT - LAST 10 WORKING DAYS', pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        pageWidth / 2,
        22,
        { align: 'center' }
      );
      doc.text(
        `Legend: P=Present, H=Half Day, A=Absent, L=Leave, W=Weekoff`,
        pageWidth / 2,
        27,
        { align: 'center' }
      );

      // Get unique dates from all employees (should be the same for all)
      const allDates: string[] = [];
      if (employeeAttendance.length > 0 && employeeAttendance[0].recentDays.length > 0) {
        employeeAttendance[0].recentDays.forEach(day => {
          allDates.push(day.date);
        });
      }

      // Prepare table headers with dates
      const dateHeaders = allDates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      
      const tableHeaders = ['Code', 'Name', ...dateHeaders, 'Absent Count', 'Status'];

      // Prepare table data with daily statuses
      const tableData = employeeAttendance.map((emp) => {
        // Get status for each date
        const dailyStatuses = allDates.map(dateStr => {
          const dayData = emp.recentDays.find(d => d.date === dateStr);
          if (!dayData || !dayData.data) return '-';
          
          // Convert status to short code
          const status = dayData.data.status;
          if (status === 'full-day') return 'P';
          if (status === 'half-day') return 'H';
          if (status === 'absent') return 'A';
          if (status === 'paid-leave' || status === 'casual-leave') return 'L';
          if (status === 'weekoff') return 'W';
          return '-';
        });
        
        return [
          emp.employeeCode,
          emp.employeeName,
          ...dailyStatuses,
          emp.analysis.absentCount || 0,
          emp.analysis.prediction
        ];
      });

      // Calculate column widths dynamically
      const leftMargin = 14;
      const rightMargin = 14;
      const availableWidth = pageWidth - leftMargin - rightMargin;
      
      const codeWidth = 18;
      const nameWidth = 45;
      const absentCountWidth = 25;
      const statusWidth = 30;
      const remainingWidth = availableWidth - codeWidth - nameWidth - absentCountWidth - statusWidth;
      const dateColumnWidth = remainingWidth / allDates.length;

      // Build column styles dynamically
      const columnStyles: any = {
        0: { cellWidth: codeWidth, halign: 'center' },
        1: { cellWidth: nameWidth, halign: 'left' }
      };
      
      // Add date column styles
      for (let i = 0; i < allDates.length; i++) {
        columnStyles[i + 2] = { cellWidth: dateColumnWidth, halign: 'center', fontStyle: 'bold' };
      }
      
      // Add absent count column style
      columnStyles[allDates.length + 2] = { cellWidth: absentCountWidth, halign: 'center', fontStyle: 'bold' };
      
      // Add status column style
      columnStyles[allDates.length + 3] = { cellWidth: statusWidth, halign: 'center', fontStyle: 'bold' };

      // Create table
      autoTable(doc, {
        startY: 35,
        head: [tableHeaders],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0],
          cellPadding: 1.5,
          fontSize: 6
        },
        bodyStyles: {
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
          cellPadding: 1.5,
          fontSize: 6,
          textColor: [0, 0, 0]
        },
        columnStyles: columnStyles,
        margin: { left: leftMargin, right: rightMargin },
        didParseCell: function(data: any) {
          // Make concerning statuses bold
          const statusColumnIndex = allDates.length + 2;
          if (data.section === 'body' && data.column.index === statusColumnIndex) {
            const status = tableData[data.row.index][statusColumnIndex];
            if (status === 'CHECK' || status === 'CONCERNING') {
              data.cell.styles.lineWidth = 0.5;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // Summary statistics
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      
      if (finalY < pageHeight - 40) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary:', 14, finalY);
        
        const activeCount = employeeAttendance.filter(e => e.analysis.predictionStatus === 'ACTIVE').length;
        const atRiskCount = employeeAttendance.filter(e => e.analysis.predictionStatus === 'AT_RISK').length;
        const likelyLeftCount = employeeAttendance.filter(e => e.analysis.predictionStatus === 'CHECK').length;
        const concerningCount = employeeAttendance.filter(e => e.analysis.predictionStatus === 'CONCERNING').length;
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Employees: ${employeeAttendance.length} | Active: ${activeCount} | At Risk: ${atRiskCount} | Concerning: ${concerningCount} | CHECK: ${likelyLeftCount}`, 14, finalY + 5);
      }

      // Footer
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }

      // Save PDF
      const fileName = `Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      console.log('[SalarySummary] ✅ Attendance report generated successfully');
    } catch (err: any) {
      console.error('Failed to generate attendance report:', err);
      alert('Failed to generate attendance report. Please try again.');
    } finally {
      setGeneratingAttendance(false);
      setAttendanceProgress(null);
    }
  };

  const handleDownloadExcel = async () => {
    if (!summaryData || !summaryData.data || summaryData.data.length === 0) return;

    try {
      // Filter out employees with zero salary
      const filteredSalaryData = summaryData.data.filter((salary) => salary.netSalary !== 0);
      
      if (filteredSalaryData.length === 0) {
        alert('No employees with non-zero salary found.');
        return;
      }

      // Fetch all employee details to get bank information
      const employeeDetailsResponse = await api.employeeDetails.getAll();
      const allEmployeeDetails = employeeDetailsResponse.data.data || [];

      // Fetch all employees to get names
      const employeesResponse = await api.employees.getAll();
      const allEmployees = employeesResponse.data.data || [];

      console.log('[Excel] API Responses:', {
        employeeDetailsCount: allEmployeeDetails.length,
        employeesCount: allEmployees.length,
        sampleDetail: allEmployeeDetails[0],
        sampleEmployee: allEmployees[0],
      });

      // Create maps for quick lookup - normalize employee codes to strings for consistent matching
      const detailsMap = new Map<string, any>();
      allEmployeeDetails.forEach((emp: any) => {
        // Try all possible field name variations and normalize to string
        const code = String(emp.employeeNo || emp.EmployeeCode || emp.employeeCode || '').trim();
        if (code) {
          // Store with normalized code (also try storing with original variations for lookup)
          detailsMap.set(code, emp);
          // Also store with any other variations if they exist
          if (emp.employeeNo && String(emp.employeeNo) !== code) detailsMap.set(String(emp.employeeNo).trim(), emp);
          if (emp.EmployeeCode && String(emp.EmployeeCode) !== code) detailsMap.set(String(emp.EmployeeCode).trim(), emp);
          if (emp.employeeCode && String(emp.employeeCode) !== code) detailsMap.set(String(emp.employeeCode).trim(), emp);
        }
      });

      const employeesMap = new Map<string, any>();
      allEmployees.forEach((emp: any) => {
        const code = String(emp.employeeNo || emp.EmployeeCode || emp.employeeCode || '').trim();
        if (code) {
          employeesMap.set(code, emp);
          // Also store with variations
          if (emp.employeeNo && String(emp.employeeNo) !== code) employeesMap.set(String(emp.employeeNo).trim(), emp);
          if (emp.EmployeeCode && String(emp.EmployeeCode) !== code) employeesMap.set(String(emp.EmployeeCode).trim(), emp);
          if (emp.employeeCode && String(emp.employeeCode) !== code) employeesMap.set(String(emp.employeeCode).trim(), emp);
        }
      });

      // Track missing bank data for debugging
      const missingBankData: Array<{ code: string; name: string; reason: string; foundInMap: boolean }> = [];
      const employeesNeedingIndividualFetch: string[] = [];

      // Prepare Excel data with columns: sr, center, name, acc, ifsc, baseSalary, grossSalary, 
      // deductions (TDS, Professional Tax, Late, Absent, Half Day, LOP, Adjustments),
      // additions (Incentive, Reimbursement, Overtime, Sunday Pay, Other Adjustments),
      // totalDeductions, netSalary
      const excelDataPromise = Promise.all(filteredSalaryData.map(async (salary, index) => {
        const employeeCode = String(salary.employeeCode).trim();
        let employeeDetails = detailsMap.get(employeeCode) || {};
        const employee = employeesMap.get(employeeCode) || {};
        const foundInMap = detailsMap.has(employeeCode);
        
        // Get employee name - EmployeeWithDetails uses 'name' field
        const employeeName = employeeDetails.name || employee.name || employee.EmployeeName || (salary as any).employeeName || employeeCode;

        // Get bank details - try all possible field name variations (case-insensitive approach)
        const getBankAccNo = (obj: any): string => {
          if (!obj || typeof obj !== 'object') return '';
          // Try all possible variations
          return obj.bankAccNo || obj.BankAccNo || obj.bankAccountNo || obj.BankAccountNo || 
                 obj.bankAcc || obj.BankAcc || obj.accountNo || obj.AccountNo || 
                 obj.accountNumber || obj.AccountNumber || '';
        };

        const getIFSCCode = (obj: any): string => {
          if (!obj || typeof obj !== 'object') return '';
          // Try all possible variations
          return obj.ifscCode || obj.IFSCCode || obj.IFSCcode || obj.IFSC || 
                 obj.ifsc || obj.IfscCode || '';
        };

        let bankAccNo = getBankAccNo(employeeDetails) || getBankAccNo(employee) || '';
        let ifscCode = getIFSCCode(employeeDetails) || getIFSCCode(employee) || '';

        // If not found in bulk fetch and missing bank data, try individual fetch
        if ((!bankAccNo || !ifscCode) && !foundInMap) {
          employeesNeedingIndividualFetch.push(employeeCode);
          try {
            const individualDetails = await api.employeeDetails.getByCode(employeeCode);
            if (individualDetails?.data?.data) {
              const individual = individualDetails.data.data;
              employeeDetails = { ...employeeDetails, ...individual };
              bankAccNo = bankAccNo || getBankAccNo(individual) || '';
              ifscCode = ifscCode || getIFSCCode(individual) || '';
            }
          } catch (err) {
            console.warn(`[Excel] Failed to fetch individual details for ${employeeCode}:`, err);
          }
        }

        const branchLocation = employeeDetails.branchLocation || employeeDetails.BranchLocation || employee.location || employee.Location || '';

        // Track missing bank data
        if (!bankAccNo || !ifscCode) {
          const reason = !bankAccNo && !ifscCode ? 'Both missing' : !bankAccNo ? 'Account number missing' : 'IFSC code missing';
          missingBankData.push({ code: employeeCode, name: employeeName, reason, foundInMap });
        }

        // Extract deductions and additions from breakdown
        const breakdown = salary.breakdown || {};
        
        // Deductions
        const tdsDeduction = (breakdown as any).tdsDeduction || 0;
        const professionalTax = (breakdown as any).professionalTax || 0;
        const lateDeduction = breakdown.lateDeduction || 0;
        const absentDeduction = breakdown.absentDeduction || 0;
        const halfDayDeduction = breakdown.halfDayDeduction || 0;
        const lopDeduction = (breakdown as any).lopDeduction || 0;
        
        // Adjustment deductions (T-Shirt, Advance, etc.)
        let adjustmentDeductions = 0;
        let tShirtDeduction = 0;
        let advanceDeduction = 0;
        if (breakdown.adjustmentDetails && breakdown.adjustmentDetails.length > 0) {
          breakdown.adjustmentDetails.forEach((adj: any) => {
            if (adj.type === 'DEDUCTION') {
              adjustmentDeductions += adj.amount;
              if (adj.category === 'T_SHIRT') {
                tShirtDeduction = adj.amount;
              } else if (adj.category === 'ADVANCE') {
                advanceDeduction = adj.amount;
              }
            }
          });
        }
        
        // Additions
        const incentiveAmount = breakdown.incentiveAmount || 0;
        const overtimeAmount = breakdown.overtimeAmount || 0;
        const sundayPay = breakdown.sundayPay || 0;
        
        // Adjustment additions (Reimbursement, etc.)
        let adjustmentAdditions = 0;
        let reimbursementAmount = 0;
        if (breakdown.adjustmentDetails && breakdown.adjustmentDetails.length > 0) {
          breakdown.adjustmentDetails.forEach((adj: any) => {
            if (adj.type === 'ADDITION' && adj.category !== 'INCENTIVE') {
              adjustmentAdditions += adj.amount;
              if (adj.category === 'REIMBURSEMENT') {
                reimbursementAmount = adj.amount;
              }
            }
          });
        }
        
        // Total deductions
        const totalDeductions = breakdown.totalDeductions || 0;

        // Debug logging for first 3 employees and any with missing data
        if (index < 3 || (!bankAccNo || !ifscCode)) {
          console.log(`[Excel] Employee ${index + 1} (${employeeCode}):`, {
            employeeDetailsKeys: Object.keys(employeeDetails),
            employeeKeys: Object.keys(employee),
            extractedData: {
              name: employeeName,
              center: branchLocation,
              acc: bankAccNo,
              ifsc: ifscCode,
            },
            rawData: {
              employeeDetails,
              employee,
            },
            lookupCode: employeeCode,
            foundInDetailsMap: detailsMap.has(employeeCode),
            foundInEmployeesMap: employeesMap.has(employeeCode),
          });
        }

        return {
          sr: index + 1,
          center: branchLocation || '',
          name: employeeName,
          acc: bankAccNo || '',
          ifsc: ifscCode || '',
          baseSalary: salary.baseSalary || 0,
          grossSalary: salary.grossSalary || 0,
          // Deductions
          tdsDeduction,
          professionalTax,
          lateDeduction,
          absentDeduction,
          halfDayDeduction,
          lopDeduction,
          tShirtDeduction,
          advanceDeduction,
          otherAdjustmentDeductions: adjustmentDeductions - tShirtDeduction - advanceDeduction,
          totalDeductions,
          // Additions
          incentiveAmount,
          reimbursementAmount,
          overtimeAmount,
          sundayPay,
          otherAdjustmentAdditions: adjustmentAdditions - reimbursementAmount,
          totalAdditions: incentiveAmount + reimbursementAmount + overtimeAmount + sundayPay + adjustmentAdditions,
          // Final amount
          netSalary: salary.netSalary,
        };
      }));

      const excelData = await excelDataPromise;

      // Log missing bank data for debugging
      if (missingBankData.length > 0) {
        console.warn(`[Excel] ⚠️ ${missingBankData.length}/${excelData.length} employees missing bank account data:`, missingBankData.slice(0, 10));
        console.warn(`[Excel] Employees not found in bulk fetch (tried individual fetch):`, employeesNeedingIndividualFetch);
      }

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      const colWidths = [
        { wch: 5 },   // sr
        { wch: 20 },  // center
        { wch: 30 },  // name
        { wch: 20 },  // acc
        { wch: 15 },  // ifsc
        { wch: 15 },  // baseSalary
        { wch: 15 },  // grossSalary
        { wch: 12 },  // tdsDeduction
        { wch: 15 },  // professionalTax
        { wch: 12 },  // lateDeduction
        { wch: 12 },  // absentDeduction
        { wch: 12 },  // halfDayDeduction
        { wch: 12 },  // lopDeduction
        { wch: 12 },  // tShirtDeduction
        { wch: 12 },  // advanceDeduction
        { wch: 18 },  // otherAdjustmentDeductions
        { wch: 15 },  // totalDeductions
        { wch: 12 },  // incentiveAmount
        { wch: 15 },  // reimbursementAmount
        { wch: 12 },  // overtimeAmount
        { wch: 12 },  // sundayPay
        { wch: 18 },  // otherAdjustmentAdditions
        { wch: 15 },  // totalAdditions
        { wch: 15 },  // netSalary
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Salary Summary');

      // Generate filename
      const monthDate = new Date(selectedMonth + '-01');
      const monthDateStr = monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const fileName = `Salary_Summary_${monthDateStr.replace(/\s+/g, '_')}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error('Failed to generate Excel file:', err);
      alert('Failed to generate Excel file. Please try again.');
    }
  };

  const handleDownloadCSV = async () => {
    if (!summaryData || !summaryData.data || summaryData.data.length === 0) return;

    try {
      // Filter out employees with zero salary
      const filteredSalaryData = summaryData.data.filter((salary) => salary.netSalary !== 0);
      
      if (filteredSalaryData.length === 0) {
        alert('No employees with non-zero salary found.');
        return;
      }

      // Fetch all employee details to get bank information
      const employeeDetailsResponse = await api.employeeDetails.getAll();
      const allEmployeeDetails = employeeDetailsResponse.data.data || [];

      // Fetch all employees to get names
      const employeesResponse = await api.employees.getAll();
      const allEmployees = employeesResponse.data.data || [];

      // Create maps for quick lookup - normalize employee codes to strings for consistent matching
      const detailsMap = new Map<string, any>();
      allEmployeeDetails.forEach((emp: any) => {
        // Try all possible field name variations and normalize to string
        const code = String(emp.employeeNo || emp.EmployeeCode || emp.employeeCode || '').trim();
        if (code) {
          // Store with normalized code (also try storing with original variations for lookup)
          detailsMap.set(code, emp);
          // Also store with any other variations if they exist
          if (emp.employeeNo && String(emp.employeeNo) !== code) detailsMap.set(String(emp.employeeNo).trim(), emp);
          if (emp.EmployeeCode && String(emp.EmployeeCode) !== code) detailsMap.set(String(emp.EmployeeCode).trim(), emp);
          if (emp.employeeCode && String(emp.employeeCode) !== code) detailsMap.set(String(emp.employeeCode).trim(), emp);
        }
      });

      const employeesMap = new Map<string, any>();
      allEmployees.forEach((emp: any) => {
        const code = String(emp.employeeNo || emp.EmployeeCode || emp.employeeCode || '').trim();
        if (code) {
          employeesMap.set(code, emp);
          // Also store with variations
          if (emp.employeeNo && String(emp.employeeNo) !== code) employeesMap.set(String(emp.employeeNo).trim(), emp);
          if (emp.EmployeeCode && String(emp.EmployeeCode) !== code) employeesMap.set(String(emp.EmployeeCode).trim(), emp);
          if (emp.employeeCode && String(emp.employeeCode) !== code) employeesMap.set(String(emp.employeeCode).trim(), emp);
        }
      });

      // Format month name (e.g., "2026-01" -> "JAN 2026")
      const [year, monthNum] = selectedMonth.split('-');
      const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const customerRefNumber = `SAL ${monthName} ${year}`;

      // Format current date as YYYYMMDD (e.g., "20260105")
      const now = new Date();
      const transactionDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      // Helper function to escape CSV values (wrap in quotes if contains comma, quote, or newline)
      const escapeCSV = (value: string | number): string => {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Helper functions to get bank details with all variations
      const getBankAccNo = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        // Try all possible variations
        return obj.bankAccNo || obj.BankAccNo || obj.bankAccountNo || obj.BankAccountNo || 
               obj.bankAcc || obj.BankAcc || obj.accountNo || obj.AccountNo || 
               obj.accountNumber || obj.AccountNumber || '';
      };

      const getIFSCCode = (obj: any): string => {
        if (!obj || typeof obj !== 'object') return '';
        // Try all possible variations
        return obj.ifscCode || obj.IFSCCode || obj.IFSCcode || obj.IFSC || 
               obj.ifsc || obj.IfscCode || '';
      };

      // Track missing bank data for debugging
      const missingBankDataCSV: Array<{ code: string; name: string; reason: string; foundInMap: boolean }> = [];
      const employeesNeedingIndividualFetchCSV: string[] = [];

      // Prepare CSV data
      const csvRowsPromise = Promise.all(filteredSalaryData.map(async (salary) => {
        const employeeCode = String(salary.employeeCode).trim();
        let employeeDetails = detailsMap.get(employeeCode) || {};
        const employee = employeesMap.get(employeeCode) || {};
        const foundInMap = detailsMap.has(employeeCode);
        
        // Get employee name
        const employeeName = employeeDetails.name || employee.name || employee.EmployeeName || (salary as any).employeeName || employeeCode;

        // Get bank details - try both employeeDetails and employee objects
        let bankAccNo = getBankAccNo(employeeDetails) || getBankAccNo(employee) || '';
        let ifscCode = getIFSCCode(employeeDetails) || getIFSCCode(employee) || '';

        // If not found in bulk fetch and missing bank data, try individual fetch
        if ((!bankAccNo || !ifscCode) && !foundInMap) {
          employeesNeedingIndividualFetchCSV.push(employeeCode);
          try {
            const individualDetails = await api.employeeDetails.getByCode(employeeCode);
            if (individualDetails?.data?.data) {
              const individual = individualDetails.data.data;
              employeeDetails = { ...employeeDetails, ...individual };
              bankAccNo = bankAccNo || getBankAccNo(individual) || '';
              ifscCode = ifscCode || getIFSCCode(individual) || '';
            }
          } catch (err) {
            console.warn(`[CSV] Failed to fetch individual details for ${employeeCode}:`, err);
          }
        }

        // Track missing data
        if (!bankAccNo || !ifscCode) {
          const reason = !bankAccNo && !ifscCode ? 'Both missing' : !bankAccNo ? 'Account number missing' : 'IFSC code missing';
          missingBankDataCSV.push({ code: employeeCode, name: employeeName, reason, foundInMap });
        }

        // CSV row: customer_ref_number, name, acc, ifsc, Transaction_Type, amount, Transaction_Date
        return [
          escapeCSV(customerRefNumber), // customer_ref_number
          escapeCSV(employeeName), // name
          escapeCSV(bankAccNo), // acc
          escapeCSV(ifscCode), // ifsc
          '11', // Transaction_Type (always 11)
          Math.round(salary.netSalary), // amount (rounded to nearest integer)
          transactionDate // Transaction_Date
        ].join(',');
      }));

      const csvRows = await csvRowsPromise;

      // Log missing bank data for debugging
      if (missingBankDataCSV.length > 0) {
        console.warn(`[CSV] ⚠️ ${missingBankDataCSV.length}/${filteredSalaryData.length} employees missing bank account data:`, missingBankDataCSV.slice(0, 10));
        console.warn(`[CSV] Employees not found in bulk fetch (tried individual fetch):`, employeesNeedingIndividualFetchCSV);
      }

      // Add header row
      const header = 'customer_ref_number,name,acc,ifsc,Transaction_Type,amount,Transaction_Date';
      const csvContent = [header, ...csvRows].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Salary_CSV_${monthName}_${year}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to generate CSV file:', err);
      alert('Failed to generate CSV file. Please try again.');
    }
  };

  // Calculate totals
  const totalBaseSalary = summaryData?.data?.reduce((sum, s) => sum + s.baseSalary, 0) || 0;
  const totalGrossSalary = summaryData?.data?.reduce((sum, s) => sum + s.grossSalary, 0) || 0;
  const totalDeductions = summaryData?.data?.reduce((sum, s) => sum + s.breakdown.totalDeductions, 0) || 0;

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-wrap gap-6 items-center justify-between animate-fade-in">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-500 rounded-full" />
            <h1 className="text-4xl font-bold text-white tracking-tight">Salary Summary</h1>
          </div>
          <p className="text-slate-400 font-medium pl-4">
            Comprehensive payroll overview for all employees
          </p>
        </div>
        {summaryData && summaryData.data && summaryData.data.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleDownloadPDF}
              disabled={loading || generatingAttendance}
              className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5" />
              Download PDF
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={loading || generatingAttendance}
              className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-5 w-5" />
              Download Excel
            </button>
            <button
              onClick={handleDownloadAttendanceReport}
              disabled={loading || generatingAttendance}
              className="flex items-center gap-3 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-violet-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingAttendance ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Attendance Report
                </>
              )}
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={loading || generatingAttendance}
              className="flex items-center gap-3 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="h-5 w-5" />
              Download CSV
            </button>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Input
          type="month"
          label="Financial Cycle"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
        <SearchableMultiSelect
          label="Branch"
          value={selectedBranch}
          onChange={(value) => setSelectedBranch(value)}
          placeholder="Select branches..."
          options={[
            { value: '', label: 'All Branches' },
            ...Array.from(new Set(employees.map(emp => emp.location).filter(loc => loc && loc !== 'N/A')))
              .sort()
              .map(branch => ({
                value: branch,
                label: branch
              }))
          ]}
        />
        <div className="flex items-end">
          <button
            onClick={fetchSalarySummary}
            disabled={loading}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Generate Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Status */}
      {summaryData && (
        <div className="p-4 rounded-[20px] bg-white/[0.02] border border-white/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            Processing Status
          </p>
          <p className="text-sm font-bold text-white">
            {summaryData.processed} / {summaryData.totalEmployees} employees processed
            {summaryData.failed > 0 && (
              <span className="text-rose-400 ml-2">({summaryData.failed} failed)</span>
            )}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="h-12 w-12 text-indigo-400 animate-spin mb-4" />
          <h3 className="text-xl font-black text-white tracking-tight mb-2">Processing Salaries</h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Calculating salaries for all employees. This may take a moment...
          </p>
          {progress && (
            <p className="text-sm text-slate-400 mt-2">
              Processing in optimized chunks to prevent server overload
            </p>
          )}
        </div>
      )}

      {/* Attendance Report Generation Progress */}
      {generatingAttendance && attendanceProgress && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="h-12 w-12 text-violet-400 animate-spin mb-4" />
          <h3 className="text-xl font-black text-white tracking-tight mb-2">Generating Attendance Report</h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Fetching attendance data for all employees...
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Processing {attendanceProgress.current} of {attendanceProgress.total} employees
          </p>
          <div className="w-full max-w-md mt-4">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${(attendanceProgress.current / attendanceProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <ErrorMessage message={error} onRetry={fetchSalarySummary} />
      )}

      {/* Salary Table */}
      {!loading && !error && summaryData && (
        <div className="animate-fade-in space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Employees', val: summaryData.totalEmployees, grad: 'from-indigo-500/20' },
              { label: 'Processed', val: summaryData.processed, grad: 'from-emerald-500/20' },
              { label: 'Failed', val: summaryData.failed, grad: 'from-rose-500/20' },
              { label: 'Total Net Salary', val: summaryData.totalNetSalary, grad: 'from-violet-500/20' },
            ].map((stat, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-[32px] bg-gradient-to-br ${stat.grad} to-transparent border border-white/5 backdrop-blur-xl shadow-2xl`}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">
                  {stat.label}
                </p>
                <p className="text-2xl font-black text-white tracking-tighter">
                  {stat.label.includes('Salary') ? formatCurrency(stat.val) : stat.val}
                </p>
              </div>
            ))}
          </div>

          {/* Salary Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Employee Code
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Name
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Base Salary
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Gross Salary
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Deductions
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
                      Net Salary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {summaryData.data && summaryData.data.map((salary) => (
                    <tr
                      key={salary.employeeCode}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded bg-white/[0.05] text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                          #{salary.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-bold">
                        {(salary as any).employeeName || salary.employeeCode || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold text-right">
                        {formatCurrency(salary.baseSalary)}
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold text-right"
                        title={`Gross: ${formatCurrency(salary.grossSalary)}`}
                      >
                        {formatCurrency(salary.grossSalary)}
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm text-rose-400 font-semibold text-right"
                        title={`Deductions: ${formatCurrency(salary.breakdown.totalDeductions)}`}
                      >
                        -{formatCurrency(salary.breakdown.totalDeductions)}
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm font-black text-emerald-400 tracking-tight text-right"
                        title={`Net Salary for ${salary.employeeCode}: ${formatCurrency(salary.netSalary)}`}
                      >
                        {formatCurrency(salary.netSalary)}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  {summaryData.data && summaryData.data.length > 0 && (
                    <tr className="bg-white/[0.05] border-t-2 border-white/10">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="text-xs font-black text-white uppercase tracking-widest">TOTAL</span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-400">
                          {summaryData.processed} Employees
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-white text-right">
                        {formatCurrency(totalBaseSalary)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-white text-right">
                        {formatCurrency(totalGrossSalary)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-black text-rose-400 text-right">
                        -{formatCurrency(totalDeductions)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-lg font-black text-emerald-400 tracking-tight text-right">
                        {formatCurrency(summaryData.totalNetSalary)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Errors Display */}
          {summaryData.errors && summaryData.errors.length > 0 && (
            <Card title="Processing Errors">
              <div className="space-y-2">
                {summaryData.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
                  >
                    <p className="text-sm font-bold text-rose-400">
                      Employee #{err.employeeCode}: {err.error}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty State */}
          {summaryData && summaryData.data && summaryData.data.length === 0 && !loading && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Calendar className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-xl font-black text-white tracking-tight mb-2">
                No Salary Data
              </h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                No employees found in EmployeeDetails table for the selected month.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial Empty State */}
      {!loading && !error && !summaryData && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Calendar className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-xl font-black text-white tracking-tight mb-2">
            Select Month to View Summary
          </h3>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Choose a financial cycle to generate the salary summary report.
          </p>
        </div>
      )}
    </div>
  );
}

