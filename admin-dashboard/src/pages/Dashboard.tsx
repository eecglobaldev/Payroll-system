import { useEffect, useState } from 'react';
import { Users, Calendar, Wallet, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/UI/StatCard';
import Card from '@/components/UI/Card';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonth } from '@/utils/format';
import type { Employee, SalaryCalculation } from '@/types';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryData, setSalaryData] = useState<SalaryCalculation[]>([]);

  const currentMonth = getCurrentMonth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all employees
      const employeesRes = await api.employees.getAll();
      const employeeList = employeesRes.data.data || [];
      setEmployees(employeeList);

      // Fetch salary data for first 5 employees (for demo)
      const salaryPromises = employeeList.slice(0, 5).map(emp =>
        api.salary.calculate(parseInt(emp.employeeNo), currentMonth)
          .then(res => res.data.data)
          .catch(() => null)
      );
      
      const salaries = (await Promise.all(salaryPromises)).filter(Boolean) as SalaryCalculation[];
      setSalaryData(salaries);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchDashboardData} />;
  }

  // Calculate stats
  const totalEmployees = employees.length;
  const todayAttendance = salaryData.reduce((sum, s) => sum + s.attendance.fullDays, 0);
  const totalSalary = salaryData.reduce((sum, s) => sum + s.netSalary, 0);
  const avgHours = salaryData.length > 0
    ? salaryData.reduce((sum, s) => sum + s.attendance.totalWorkedHours, 0) / salaryData.length
    : 0;

  // Prepare chart data
  const attendanceChartData = salaryData.map(s => ({
    name: s.employeeCode,
    fullDays: s.attendance.fullDays,
    halfDays: s.attendance.halfDays,
    absent: s.attendance.absentDays,
  }));

  const salaryChartData = salaryData.map(s => ({
    name: s.employeeCode,
    baseSalary: s.baseSalary,
    netSalary: s.netSalary,
    deductions: s.breakdown.totalDeductions,
  }));

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-indigo-500 rounded-full" />
          <h1 className="text-4xl font-bold text-white tracking-tight">Executive Dashboard</h1>
        </div>
        <p className="text-slate-400 font-medium pl-4">
          Corporate performance and workforce analytics for {currentMonth}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Workforce Size"
          value={totalEmployees}
          icon={Users}
          color="blue"
          trend={{ value: "2.4%", isPositive: true }}
        />
        <StatCard
          title="Active Presence"
          value={todayAttendance}
          icon={Calendar}
          color="green"
          trend={{ value: "12%", isPositive: true }}
        />
        <StatCard
          title="Monthly Payroll"
          value={formatCurrency(totalSalary)}
          icon={Wallet}
          color="purple"
          trend={{ value: "0.8%", isPositive: false }}
        />
        <StatCard
          title="Avg Efficiency"
          value={`${avgHours.toFixed(1)}h`}
          icon={Clock}
          color="orange"
          trend={{ value: "4.2%", isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Attendance Performance Metrics">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorFull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="fullDays" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="halfDays" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Financial Disbursement Trends">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salaryChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="netSalary" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card title="Personnel Roster Extract" action={
        <button onClick={() => window.location.href='/employees'} className="px-4 py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">
          Full Directory →
        </button>
      }>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Serial</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Identity</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Business Unit</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">Total Comp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {employees.slice(0, 5).map((employee) => (
                <tr key={employee.employeeNo} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-5 whitespace-nowrap text-xs font-bold text-slate-500">#{employee.employeeNo}</td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">{employee.name}</td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-400 font-semibold">{employee.department}</td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm text-white font-bold">{formatCurrency(employee.fullBasic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

