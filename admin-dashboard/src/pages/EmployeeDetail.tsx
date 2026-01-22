import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Edit2, Check, X, Calendar, Clock, Trash2, Plus } from 'lucide-react';
import Card from '@/components/UI/Card';
import Badge from '@/components/UI/Badge';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import SearchableSelect from '@/components/UI/SearchableSelect';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getCurrentMonth, getMonthName } from '@/utils/format';
import type { Employee, SalaryCalculation } from '@/types';

// Helper function to format display values
const formatDisplayValue = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined || value === '' || value === 'N/A') {
    return 'N/A';
  }
  return String(value);
};

// Helper function to format date from Excel
const formatJoinDate = (dateStr: string | undefined | null): string => {
  if (!dateStr || dateStr === 'N/A' || dateStr === '') {
    return 'N/A';
  }
  // Try to parse and format the date
  try {
    // Excel dates might be in various formats, try parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return formatDate(date, 'dd MMM yyyy');
    }
    return dateStr; // Return as-is if can't parse
  } catch {
    return dateStr;
  }
};

export default function EmployeeDetail() {
  const { employeeNo } = useParams<{ employeeNo: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [salary, setSalary] = useState<SalaryCalculation | null>(null);
  const [shifts, setShifts] = useState<Array<{ value: string; label: string }>>([]);
  const [isEditingShift, setIsEditingShift] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);
  
  // Shift Assignment State
  const [shiftAssignments, setShiftAssignments] = useState<Array<{
    Id: number;
    EmployeeCode: string;
    ShiftName: string;
    FromDate: string;
    ToDate: string;
    CreatedAt: string;
  }>>([]);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    shiftName: '',
    fromDate: '',
    toDate: '',
  });
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const currentMonth = getCurrentMonth();

  useEffect(() => {
    if (employeeNo) {
      fetchEmployeeData();
      fetchShifts();
      fetchShiftAssignments();
    }
  }, [employeeNo]);

  const fetchShifts = async () => {
    try {
      const response = await api.shifts.getAll();
      const shiftsData = response.data.data || [];
      
      // Format shifts for dropdown: "ShiftName (StartTime - EndTime)" or "ShiftName (Slot1 | Slot2)"
      const formattedShifts = shiftsData.map((shift: any) => {
        // Helper to parse time from Date object or string
        const parseTime = (timeValue: any): string => {
          if (timeValue instanceof Date) {
            return timeValue.toTimeString().slice(0, 5); // HH:MM
          } else if (typeof timeValue === 'string') {
            return timeValue.slice(0, 5); // HH:MM:SS -> HH:MM
          }
          return '';
        };
        
        let timingLabel = '';
        
        // Check if split shift
        if (shift.IsSplitShift) {
          const start1 = parseTime(shift.StartTime_1);
          const end1 = parseTime(shift.EndTime_1);
          const start2 = parseTime(shift.StartTime_2);
          const end2 = parseTime(shift.EndTime_2);
          timingLabel = `${start1}–${end1} | ${start2}–${end2}`;
        } else {
          const startTime = parseTime(shift.StartTime);
          const endTime = parseTime(shift.EndTime);
          timingLabel = `${startTime}–${endTime}`;
        }
        
        const label = `Shift ${shift.ShiftName} (${timingLabel})${shift.WorkHours < 9 ? ' - Part Time' : ''}`;
        
        return {
          value: shift.ShiftName,
          label: label
        };
      });
      
      // Add empty option for "No Shift"
      setShifts([
        { value: '', label: 'No Shift Assigned' },
        ...formattedShifts
      ]);
    } catch (err: any) {
      console.error('Failed to fetch shifts:', err);
      setShifts([{ value: '', label: 'No Shift Assigned' }]);
    }
  };

  const fetchEmployeeData = async () => {
    if (!employeeNo) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [empRes, salaryRes] = await Promise.all([
        api.employeeDetails.getByCode(employeeNo),
        api.salary.calculate(parseInt(employeeNo), currentMonth).catch(() => null),
      ]);

      const empDataRaw: any = empRes.data.data || null;
      if (empDataRaw) {
        // Map employeeWithDetails to Employee type
        const empData: Employee = {
          employeeNo: empDataRaw.employeeNo,
          name: empDataRaw.name,
          department: empDataRaw.department || 'N/A',
          designation: empDataRaw.designation || 'N/A',
          fullBasic: empDataRaw.basicSalary || 0,
          monthlyCTC: empDataRaw.monthlyCTC || 0,
          annualCTC: empDataRaw.annualCTC || 0,
          joinDate: empDataRaw.joiningDate || 'N/A',
          status: empDataRaw.isActive ? 'Active' : 'Exited',
          location: empDataRaw.branchLocation || 'N/A',
          joiningDate: empDataRaw.joiningDate,
          exitDate: empDataRaw.exitDate,
          isActive: empDataRaw.isActive,
          shift: empDataRaw.shift,
          BankAccountNo: empDataRaw.bankAccNo || '',
          IFSCcode: empDataRaw.ifscCode || '',
        };
        setEmployee(empData);
        setSelectedShift(empData.shift || '');
      }
      setSalary(salaryRes?.data.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = async () => {
    if (!employeeNo) return;
    
    setIsUpdatingShift(true);
    try {
      // Use employee-details update endpoint
      const response = await api.employeeDetails.update(employeeNo, { shift: selectedShift || null });
      
      if (response.data.success) {
        // Update local employee state
        setEmployee(prev => prev ? { ...prev, shift: selectedShift || null } : null);
        setIsEditingShift(false);
      } else {
        throw new Error(response.data.message || 'Failed to update shift');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update shift');
    } finally {
      setIsUpdatingShift(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedShift(employee?.shift || '');
    setIsEditingShift(false);
  };

  // Helper to get shift display label
  const getShiftLabel = (shiftValue: string | null | undefined): string => {
    if (!shiftValue) return 'N/A';
    const shift = shifts.find(s => s.value === shiftValue);
    return shift ? shift.label : shiftValue;
  };

  const fetchShiftAssignments = async () => {
    if (!employeeNo) return;
    
    try {
      // Get assignments for current month (26th to 25th)
      const currentMonth = getCurrentMonth();
      const [year, monthNum] = currentMonth.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 26);
      const endDate = new Date(year, monthNum, 25);
      
      const response = await api.employeeShifts.getAssignments(
        employeeNo,
        formatDate(startDate, 'yyyy-MM-dd'),
        formatDate(endDate, 'yyyy-MM-dd')
      );
      setShiftAssignments(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch shift assignments:', err);
      setShiftAssignments([]);
    }
  };

  const handleCreateAssignment = async () => {
    if (!employeeNo || !assignmentForm.shiftName || !assignmentForm.fromDate || !assignmentForm.toDate) {
      setError('Please fill all fields');
      return;
    }

    if (assignmentForm.fromDate > assignmentForm.toDate) {
      setError('From date must be before or equal to to date');
      return;
    }

    setIsSubmittingAssignment(true);
    setError(null);

    try {
      await api.employeeShifts.assign({
        employeeCode: employeeNo,
        shiftName: assignmentForm.shiftName,
        fromDate: assignmentForm.fromDate,
        toDate: assignmentForm.toDate,
      });

      // Reset form and refresh assignments
      setAssignmentForm({ shiftName: '', fromDate: '', toDate: '' });
      setIsAssignmentModalOpen(false);
      await fetchShiftAssignments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create shift assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this shift assignment?')) return;

    try {
      await api.employeeShifts.deleteAssignment(id);
      await fetchShiftAssignments();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete shift assignment');
    }
  };


  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error || !employee) {
    return <ErrorMessage message={error || 'Employee not found'} onRetry={fetchEmployeeData} />;
  }

  return (
    <div className="space-y-10">
      {/* Back Button */}
      <button
        onClick={() => navigate('/employees')}
        className="group flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest animate-fade-in"
      >
        <div className="p-2 rounded-lg bg-white/[0.03] group-hover:bg-indigo-600 transition-colors">
          <ArrowLeft className="h-3 w-3" />
        </div>
        Personnel Directory
      </button>

      {/* Employee Header */}
      <div className="p-10 rounded-[32px] glass-card flex flex-col md:flex-row items-center md:items-start gap-10 animate-fade-in shadow-2xl">
        <div className="relative group">
          <div className="h-32 w-32 rounded-[32px] bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <User className="h-16 w-16 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-green-500 border-4 border-[#0f172a] shadow-lg shadow-green-500/20" />
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
            <h1 className="text-4xl font-black text-white tracking-tighter">{employee.name}</h1>
            <span className="px-3 py-1 rounded-full bg-white/[0.05] text-[10px] font-bold text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">#{employee.employeeNo}</span>
          </div>
          <p className="text-lg text-slate-400 font-semibold mb-6">
            {formatDisplayValue(employee.designation)} — {formatDisplayValue(employee.department)}
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <Badge variant="success" size="md">{formatDisplayValue(employee.status)}</Badge>
            <Badge variant="info" size="md">{formatDisplayValue(employee.location)}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-[200px]">
          <button
            onClick={() => navigate(`/attendance?employee=${employeeNo}`)}
            className="w-full py-4 px-6 glass-card rounded-2xl text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg"
          >
            Attendance Logs
          </button>
          <button
            onClick={() => navigate(`/salary?employee=${employeeNo}`)}
            className="w-full py-4 px-6 glass-card rounded-2xl text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
          >
            Financial Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card title="Personnel Context">
          <div className="space-y-6">
            {[
              { label: 'Full Designation', val: formatDisplayValue(employee.designation) },
              { label: 'Business Unit', val: formatDisplayValue(employee.department) },
              { label: 'Assigned Facility', val: formatDisplayValue(employee.location) },
              { label: 'Onboarding Date', val: formatJoinDate(employee.joinDate) },
            ].map((item, idx) => (
              <div key={idx}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-sm font-bold text-white">{item.val}</p>
              </div>
            ))}
            
            {/* Shift Field with Edit */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Work Shift</p>
                {!isEditingShift && (
                  <button
                    onClick={() => setIsEditingShift(true)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-indigo-600 transition-colors group"
                    title="Edit Shift"
                  >
                    <Edit2 className="h-3 w-3 text-slate-400 group-hover:text-white" />
                  </button>
                )}
              </div>
              {isEditingShift ? (
                <div className="space-y-3">
                  <SearchableSelect
                    value={selectedShift}
                    onChange={setSelectedShift}
                    options={shifts}
                    placeholder="Select shift..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateShift}
                      disabled={isUpdatingShift}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-3 w-3" />
                      {isUpdatingShift ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isUpdatingShift}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-white">{getShiftLabel(employee.shift)}</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Compensation Model">
          <div className="space-y-6">
            {[
              { label: 'Contractual Base', val: formatCurrency(employee.fullBasic), bold: true },
              { label: 'Monthly CTC (Est)', val: formatCurrency(employee.monthlyCTC) },
              { label: 'Annual CTC (Est)', val: formatCurrency(employee.annualCTC) },
            ].map((item, idx) => (
              <div key={idx}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                <p className={`text-sm font-bold ${item.bold ? 'text-indigo-400 text-lg' : 'text-white'}`}>{item.val}</p>
              </div>
            ))}
          </div>
        </Card>

        {salary && (
          <Card title={`Performance - ${getMonthName(currentMonth)}`}>
            <div className="space-y-6 text-center lg:text-left">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cycle Disbursement</p>
                <p className="text-3xl font-black text-emerald-400 tracking-tighter">{formatCurrency(salary.netSalary)}</p>
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Presence</p>
                  <p className="text-sm font-bold text-white">{salary.attendance.actualDaysWorked} <span className="text-slate-500">/ {salary.attendance.expectedWorkingDays}d</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Adjustments</p>
                  <p className="text-sm font-bold text-rose-400">-{formatCurrency(salary.breakdown.totalDeductions)}</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Shift Assignments Section */}
      <Card title="Date-wise Shift Assignments" action={
        <button
          onClick={() => setIsAssignmentModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
        >
          <Plus className="h-3 w-3" />
          Assign Shift
        </button>
      }>
        {shiftAssignments.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-sm text-slate-400 font-medium">No shift assignments found</p>
            <p className="text-xs text-slate-500 mt-2">Employee will use default shift from Employee Details</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shiftAssignments.map((assignment) => (
              <div
                key={assignment.Id}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-indigo-600/20">
                      <Calendar className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">
                          {getShiftLabel(assignment.ShiftName)}
                        </span>
                        <Badge variant="info" size="sm">{assignment.ShiftName}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDate(new Date(assignment.FromDate), 'dd MMM yyyy')} - {formatDate(new Date(assignment.ToDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.Id)}
                    className="p-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 transition-colors"
                    title="Delete assignment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assignment Modal */}
      {isAssignmentModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Assign Shift</h3>
              <button
                onClick={() => {
                  setIsAssignmentModalOpen(false);
                  setAssignmentForm({ shiftName: '', fromDate: '', toDate: '' });
                  setError(null);
                }}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-600/20 border border-rose-600/30">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Shift
                </label>
                <SearchableSelect
                  value={assignmentForm.shiftName}
                  onChange={(value) => setAssignmentForm({ ...assignmentForm, shiftName: value })}
                  options={shifts.filter(s => s.value !== '')}
                  placeholder="Select shift..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={assignmentForm.fromDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, fromDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white/[0.05] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={assignmentForm.toDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, toDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white/[0.05] transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateAssignment}
                  disabled={isSubmittingAssignment}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4" />
                  {isSubmittingAssignment ? 'Creating...' : 'Create Assignment'}
                </button>
                <button
                  onClick={() => {
                    setIsAssignmentModalOpen(false);
                    setAssignmentForm({ shiftName: '', fromDate: '', toDate: '' });
                    setError(null);
                  }}
                  disabled={isSubmittingAssignment}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

