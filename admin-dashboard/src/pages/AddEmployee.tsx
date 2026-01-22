/**
 * Add Employee Page
 * Form to create new employee details in the database
 * 
 * REPLACES: Manual Excel data entry
 * PURPOSE: Database-driven employee onboarding
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, UserPlus } from 'lucide-react';
import Card from '@/components/UI/Card';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { api } from '@/lib/api';

interface EmployeeFormData {
  employeeCode: string;
  joiningDate: string;
  branchLocation: string;
  department: string;
  designation: string;
  basicSalary: string;
  monthlyCTC: string;
  annualCTC: string;
  gender: string;
  phoneNumber: string;
}

export default function AddEmployee() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeCode: '',
    joiningDate: '',
    branchLocation: '',
    department: '',
    designation: '',
    basicSalary: '',
    monthlyCTC: '',
    annualCTC: '',
    gender: '',
    phoneNumber: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required fields
      if (!formData.employeeCode.trim()) {
        throw new Error('Employee Code is required');
      }
      if (!formData.basicSalary || parseFloat(formData.basicSalary) <= 0) {
        throw new Error('Basic Salary must be greater than 0');
      }

      // Prepare request data
      const requestData = {
        employeeCode: formData.employeeCode.trim(),
        joiningDate: formData.joiningDate || null,
        branchLocation: formData.branchLocation.trim() || null,
        department: formData.department.trim() || null,
        designation: formData.designation.trim() || null,
        basicSalary: parseFloat(formData.basicSalary),
        monthlyCTC: formData.monthlyCTC ? parseFloat(formData.monthlyCTC) : null,
        annualCTC: formData.annualCTC ? parseFloat(formData.annualCTC) : null,
        gender: formData.gender || null,
        phoneNumber: formData.phoneNumber.trim() || null,
        createdBy: 'Admin', // TODO: Get from auth context
      };

      // Call API
      const response = await api.post('/api/employee-details', requestData);

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/employees');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error creating employee:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create employee details');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      employeeCode: '',
      joiningDate: '',
      branchLocation: '',
      department: '',
      designation: '',
      basicSalary: '',
      monthlyCTC: '',
      annualCTC: '',
      gender: '',
      phoneNumber: '',
    });
    setError(null);
    setSuccess(false);
  };

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
        Back to Employees
      </button>

      {/* Page Header */}
      <div className="flex items-center gap-4 animate-fade-in">
        <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-2xl shadow-indigo-500/20">
          <UserPlus className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Add New Employee</h1>
          <p className="text-slate-400 font-semibold mt-1">Create employee details in database</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 animate-fade-in">
          <p className="text-green-400 font-bold text-center">
            ✅ Employee details created successfully! Redirecting...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 animate-fade-in">
          <p className="text-red-400 font-bold text-center">{error}</p>
        </div>
      )}

      {/* Form */}
      <Card title="Employee Information">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Employee Code */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Employee Code <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="employeeCode"
              value={formData.employeeCode}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g., 1001"
            />
            <p className="text-xs text-slate-500 mt-1">Must match existing employee code in Employees table</p>
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g., +91 9876543210"
              />
            </div>
          </div>

          {/* HR Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Joining Date
              </label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Branch Location
              </label>
              <input
                type="text"
                name="branchLocation"
                value={formData.branchLocation}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g., Mumbai Office"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g., Engineering"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Designation
              </label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g., Senior Software Engineer"
              />
            </div>
          </div>

          {/* Salary Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Salary Details</h3>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Basic Salary (Monthly) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g., 50000"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Monthly CTC
                </label>
                <input
                  type="number"
                  name="monthlyCTC"
                  value={formData.monthlyCTC}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g., 60000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Annual CTC
                </label>
                <input
                  type="number"
                  name="annualCTC"
                  value={formData.annualCTC}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g., 720000"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Create Employee
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </form>
      </Card>

      {/* Important Notes */}
      <Card title="Important Notes">
        <div className="space-y-3 text-sm text-slate-400">
          <p>• Employee Code must already exist in the Employees table</p>
          <p>• Basic Salary is required and will be used for salary calculations</p>
          <p>• All other fields are optional but recommended for complete records</p>
          <p>• Salary values should be in INR (Indian Rupees)</p>
          <p>• Once created, you can update details from the employee detail page</p>
        </div>
      </Card>
    </div>
  );
}

