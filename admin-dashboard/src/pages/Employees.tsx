import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, UserPlus, Save } from 'lucide-react';
import Card from '@/components/UI/Card';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/format';
import { BRANCHES } from '../../data/branches';
import type { Employee } from '@/types';

// Helper function to format display values
const formatDisplayValue = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined || value === '' || value === 'N/A') {
    return 'N/A';
  }
  return String(value);
};

export default function Employees() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [shifts, setShifts] = useState<Array<{ value: string; label: string }>>([]);

  // Form State
  const [formData, setFormData] = useState({
    employeeNo: '',
    name: '',
    department: '',
    designation: '',
    fullBasic: '',
    location: BRANCHES[0]?.name || '',
    status: 'Active',
    joiningDate: new Date().toISOString().split('T')[0], // Default to today
    gender: '',
    phoneNumber: '',
    shift: '',
    monthlyCTC: '',
    annualCTC: '',
    BankAccNo: '',
    IFSCCode: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchShifts();
  }, []);

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
      
      // Add empty option at the beginning
      setShifts([
        { value: '', label: 'Select Shift (Optional)' },
        ...formattedShifts
      ]);
    } catch (err: any) {
      console.error('Failed to fetch shifts:', err);
      // Fallback to empty array with just the placeholder
      setShifts([{ value: '', label: 'Select Shift (Optional)' }]);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const filtered = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNo.includes(searchTerm) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.employees.getAll();
      const employeeList = response.data.data || [];
      setEmployees(employeeList);
      setFilteredEmployees(employeeList);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleViewEmployee = (employeeNo: string) => {
    navigate(`/employees/${employeeNo}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Prepare request data for the new API
      const requestData = {
        employeeCode: formData.employeeNo.trim(),
        joiningDate: formData.joiningDate || new Date().toISOString().split('T')[0],
        branchLocation: formData.location || null,
        department: formData.department.trim() || null,
        designation: formData.designation.trim() || null,
        basicSalary: parseFloat(formData.fullBasic),
        monthlyCTC: formData.monthlyCTC ? parseFloat(formData.monthlyCTC) : (parseFloat(formData.fullBasic) || 0) * 1.2,
        annualCTC: formData.annualCTC ? parseFloat(formData.annualCTC) : (parseFloat(formData.fullBasic) || 0) * 14.4,
        gender: formData.gender || null,
        phoneNumber: formData.phoneNumber.trim() || null,
        shift: formData.shift || null,
        BankAccNo: formData.BankAccNo || null,
        IFSCCode: formData.IFSCCode || null,
        createdBy: 'Admin',
      };

      // Call the new employee-details API
      await api.employeeDetails.create(requestData);
      
      // Refresh employee list
      await fetchEmployees();
      
      // Close modal and reset form
      setIsModalOpen(false);
      setFormData({
        employeeNo: '',
        name: '',
        department: '',
        designation: '',
        fullBasic: '',
        location: BRANCHES[0]?.name || '',
        status: 'Active',
        joiningDate: new Date().toISOString().split('T')[0],
        gender: '',
        phoneNumber: '',
        shift: '',
        monthlyCTC: '',
        annualCTC: '',
        BankAccNo: '',
        IFSCCode: ''
      });
      
      alert('Employee onboarded successfully!');
    } catch (err: any) {
      console.error('Failed to onboard employee:', err);
      alert(err.response?.data?.message || 'Failed to onboard employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchEmployees} />;
  }

  return (
    <>
      <div className="space-y-10">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-500 rounded-full" />
            <h1 className="text-4xl font-bold text-white tracking-tight">Employees</h1>
          </div>
          <p className="text-slate-400 font-medium pl-4">
            Corporate directory and personnel management
          </p>
        </div>

        {/* Search & Actions Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
          <div className="lg:col-span-3 relative group">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, code, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white/[0.03] border border-white/5 rounded-[20px] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white/[0.05] transition-all font-medium"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="h-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add New Employee
          </button>
        </div>

        {/* Employees Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">ID</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Full Name</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Department</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Position</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Salary</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.employeeNo} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="px-2 py-1 rounded bg-white/[0.05] text-[10px] font-bold text-indigo-400 border border-indigo-500/20">#{employee.employeeNo}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">{employee.name}</td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">{formatDisplayValue(employee.department)}</td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">{formatDisplayValue(employee.designation)}</td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">
                      {employee.fullBasic > 0 ? formatCurrency(employee.fullBasic) : 'N/A'}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <button
                        onClick={() => handleViewEmployee(employee.employeeNo)}
                        className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-indigo-600 rounded-lg transition-all"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Onboarding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop - High contrast dark overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" 
            onClick={() => !isSubmitting && setIsModalOpen(false)} 
          />
          
          {/* Modal Content - Solid Slate background */}
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/20 rounded-[32px] shadow-[0_0_100px_rgba(79,70,229,0.4)] overflow-hidden animate-fade-in">
            <div className="px-8 py-6 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                <h2 className="text-xs font-black text-white uppercase tracking-[0.3em]">Personnel Onboarding</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-10 max-h-[80vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label="Employee ID"
                    name="employeeNo"
                    placeholder="e.g. 1001"
                    value={formData.employeeNo}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="Full Name"
                    name="name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="Joining Date"
                    name="joiningDate"
                    type="date"
                    value={formData.joiningDate}
                    onChange={handleInputChange}
                    required
                  />
                  <Select
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    options={[
                      { value: '', label: 'Select Gender' },
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                      { value: 'Other', label: 'Other' }
                    ]}
                  />
                  <Input
                    label="Phone Number"
                    name="phoneNumber"
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                  />
                  <Input
                    label="Department"
                    name="department"
                    placeholder="e.g. Engineering"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="Position"
                    name="designation"
                    placeholder="e.g. Software Engineer"
                    value={formData.designation}
                    onChange={handleInputChange}
                    required
                  />
                  <Select
                    label="Primary Location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    options={BRANCHES.map(branch => ({
                      value: branch.name,
                      label: branch.name
                    }))}
                  />
                  <Select
                    label="Shift"
                    name="shift"
                    value={formData.shift}
                    onChange={handleInputChange}
                    options={shifts.length > 0 ? shifts : [{ value: '', label: 'Loading shifts...' }]}
                  />
                  <Input
                    label="Basic Salary (INR)"
                    name="fullBasic"
                    type="number"
                    placeholder="e.g. 50000"
                    value={formData.fullBasic}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="Monthly CTC (INR)"
                    name="monthlyCTC"
                    type="number"
                    placeholder="Auto-calculated if empty"
                    value={formData.monthlyCTC}
                    onChange={handleInputChange}
                  />
                  <Input
                    label="Annual CTC (INR)"
                    name="annualCTC"
                    type="number"
                    placeholder="Auto-calculated if empty"
                    value={formData.annualCTC}
                    onChange={handleInputChange}
                  />
                   <Input
                    label="Bank Account No."
                    name="BankAccNo"
                    type="number"
                    placeholder="e.g. 1234567890"
                    value={formData.BankAccNo}
                    onChange={handleInputChange}
                  />
                  <Input
                    label="IFSC Code"
                    name="IFSCCode"
                    type="text"
                    placeholder="e.g. SBIN0001234"
                    value={formData.IFSCCode}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pt-8 border-t border-white/10 flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-8 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/40 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Onboard Personnel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

