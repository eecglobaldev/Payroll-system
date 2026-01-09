import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { getCurrentSalary } from '../services/api';
import { SalaryRecord, SalaryStatus } from '../types';
import { 
  ChevronRight, 
  Calendar, 
  AlertCircle, 
  ArrowUpRight, 
  UserCheck, 
  CreditCard, 
  Sparkles, 
  LayoutGrid,
  Zap,
  Activity,
  ArrowRight
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [latestSalary, setLatestSalary] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyAccrual, setDailyAccrual] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get latest salary (no month parameter = get latest available)
        const salary = await getCurrentSalary(); // No month = get latest
        
        setLatestSalary(salary);
        
        // Use per day rate from backend (from EmployeeDetails)
        // If not available, fallback to calculation
        if (salary) {
          if (salary.perDayRate && salary.perDayRate > 0) {
            setDailyAccrual(Math.round(salary.perDayRate));
          } else if (salary.baseSalary && salary.baseSalary > 0) {
            // Fallback: Calculate using base salary / 30 days
            setDailyAccrual(Math.round(salary.baseSalary / 30));
          } else {
            setDailyAccrual(0);
          }
        } else {
          setDailyAccrual(0);
        }
      } catch (err) {
        console.error('Failed to fetch salary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load salary data');
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);

  return (
    <div className="space-y-12 max-w-7xl mx-auto px-4 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-8">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Operational Intelligence</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">
            Greetings, {user?.name.split(' ')[0] || 'Employee'}
          </h1>
          <p className="text-slate-400 font-medium text-lg">System status nominal. All modules active.</p>
        </div>
        
        <div className="flex items-center space-x-4">
           <div className="p-4 bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] shadow-sm">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Efficiency Score</p>
             <div className="flex items-baseline justify-center space-x-1">
               <span className="text-2xl font-black text-indigo-600">9.4</span>
               <span className="text-xs font-bold text-slate-400">/10</span>
             </div>
           </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50/50 backdrop-blur-xl border border-rose-100 rounded-[2.5rem] p-6 flex items-center space-x-6 shadow-sm">
          <div className="p-4 bg-rose-500 rounded-3xl text-white shadow-xl shadow-rose-200">
            <AlertCircle size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-rose-900 uppercase tracking-[0.1em] mb-1">Error Loading Data</h4>
            <p className="text-sm text-rose-700 font-semibold opacity-80">{error}</p>
          </div>
        </div>
      )}

      {latestSalary?.status === SalaryStatus.HOLD && (
        <div className="bg-rose-50/50 backdrop-blur-xl border border-rose-100 rounded-[2.5rem] p-6 flex items-center space-x-6 shadow-sm animate-in">
          <div className="p-4 bg-rose-500 rounded-3xl text-white shadow-xl shadow-rose-200 animate-pulse">
            <AlertCircle size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-rose-900 uppercase tracking-[0.1em] mb-1">Administrative Halt Detected</h4>
            <p className="text-sm text-rose-700 font-semibold opacity-80">Payroll cycle for {latestSalary.month} is pending review.</p>
          </div>
          <button className="text-xs font-black text-white bg-rose-500 hover:bg-rose-600 px-6 py-3 rounded-2xl transition-all shadow-lg shadow-rose-200">
            Action Required
          </button>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Real-time Accrual & Monthly Hero */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* DAILY SALARY WIDGET */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="glass" className="relative group border-none ring-1 ring-slate-100 overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Zap size={120} strokeWidth={1} className="text-amber-500" />
               </div>
               <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                   <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                     <Zap size={20} />
                   </div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Daily Accrual</h3>
                 </div>
                 {loading ? (
                   <div className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                 ) : (
                   <>
                     <div className="flex items-baseline space-x-2">
                       <span className="text-4xl font-black text-slate-900 tracking-tight">₹{dailyAccrual.toLocaleString()}</span>
                       <span className="text-slate-400 font-bold text-sm uppercase">Per Day</span>
                     </div>
                     <div className="mt-6 space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Shift Performance</span>
                          <span className="text-amber-600">Fixed</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 w-full rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                        </div>
                     </div>
                   </>
                 )}
               </div>
            </Card>

            <Card variant="glass" className="relative group border-none ring-1 ring-slate-100 overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <CreditCard size={120} strokeWidth={1} className="text-indigo-500" />
               </div>
               <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                   <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                     <CreditCard size={20} />
                   </div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Basic Salary</h3>
                 </div>
                 {loading ? (
                   <div className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                 ) : (
                   <>
                     <div className="flex items-baseline space-x-2">
                       <span className="text-4xl font-black text-slate-900 tracking-tight">
                         ₹{latestSalary?.baseSalary ? latestSalary.baseSalary.toLocaleString() : '0'}
                       </span>
                       <span className="text-slate-400 font-bold text-sm uppercase">Monthly</span>
                     </div>
                     <div className="mt-6 space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Base Allocation</span>
                          <span className="text-indigo-600">Fixed</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 w-full rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        </div>
                     </div>
                   </>
                 )}
               </div>
            </Card>

            {/* <Card variant="glass" className="relative group border-none ring-1 ring-slate-100 overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Activity size={120} strokeWidth={1} className="text-emerald-500" />
               </div>
               <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-6">
                   <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                     <Activity size={20} />
                   </div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Month-to-Date</h3>
                 </div>
                 {loading ? (
                   <div className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                 ) : (
                   <>
                     <div className="flex items-baseline space-x-2">
                       <span className="text-4xl font-black text-slate-900 tracking-tight">₹{(dailyAccrual * 12).toLocaleString()}</span>
                       <span className="text-emerald-500 font-bold text-sm uppercase flex items-center">
                         <ArrowUpRight size={14} className="mr-1" /> Verified
                       </span>
                     </div>
                     <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Payout: 14 Days</p>
                   </>
                 )}
               </div>
            </Card> */}
          </div>

          {/* MONTHLY PAYROLL HERO */}
          <Card className="relative overflow-hidden group border-none">
            <div className="absolute top-0 right-0 p-12 opacity-[0.05] -rotate-12 translate-x-1/4 -translate-y-1/4 transition-transform duration-1000 group-hover:rotate-0 group-hover:scale-110">
               <CreditCard size={320} strokeWidth={1} />
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center space-x-4">
                  <div className="p-4 bg-indigo-600 text-white rounded-[1.8rem] shadow-xl shadow-indigo-100">
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Latest Disbursement</h3>
                    <p className="text-sm font-black text-slate-900">
                      {loading ? 'Loading...' : `${latestSalary?.month || 'N/A'} Cycle Ledger`}
                    </p>
                  </div>
                </div>
                {latestSalary && (
                  <Badge variant={latestSalary.status === SalaryStatus.PAID ? 'success' : 'danger'}>
                    {latestSalary.status}
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                </div>
              ) : latestSalary ? (
                <>
                  <div className="flex flex-col mb-12">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Total Net Realized</p>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-7xl font-black text-slate-900 tracking-tighter">
                        ₹{latestSalary.netSalary ? latestSalary.netSalary.toLocaleString() : '0'}
                      </span>
                      <span className="text-slate-300 font-bold text-xl uppercase tracking-widest">INR</span>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <EarningStat 
                      label="Gross Potential" 
                      value={`₹${latestSalary.grossSalary ? Math.round(latestSalary.grossSalary).toLocaleString() : '0'}`} 
                    />
                    <EarningStat 
                      label="Base Salary" 
                      value={`₹${latestSalary.baseSalary ? Math.round(latestSalary.baseSalary).toLocaleString() : '0'}`} 
                      color="text-indigo-600"
                    />
                    <EarningStat 
                      label="Total Deductions" 
                      value={`₹${latestSalary.grossSalary && latestSalary.netSalary ? Math.round(latestSalary.grossSalary - latestSalary.netSalary).toLocaleString() : '0'}`} 
                      color="text-rose-500" 
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-6 bg-amber-50 text-amber-600 rounded-3xl mb-6">
                    <AlertCircle size={32} strokeWidth={2} />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-2">Salary Not Finalized</h4>
                  <p className="text-sm text-slate-600">Salary not finalized yet. Please contact HR.</p>
                  <p className="text-sm text-slate-500 font-semibold max-w-md">
                    Salary for this month has not been generated yet. Please contact HR for more information.
                  </p>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-slate-100/50">
                <Link to="/salary" className="group/link inline-flex items-center text-sm font-black text-indigo-600 tracking-tight">
                  View Comprehensive Earnings Audit
                  <ArrowRight size={18} className="ml-2 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Mini-Widgets & Profile */}
        <div className="lg:col-span-4 space-y-8">
          <Card title="Module Navigation">
             <div className="space-y-4">
               <NavWidget 
                  to="/attendance" 
                  icon={<Calendar className="text-indigo-600" size={20} />} 
                  label="Attendance Engine" 
                  desc="Operational: 98%"
                  bgColor="bg-indigo-50"
               />
               <NavWidget 
                  to="/profile" 
                  icon={<UserCheck className="text-blue-600" size={20} />} 
                  label="Profile Config" 
                  desc="Verified Identity"
                  bgColor="bg-blue-50"
               />
             </div>
          </Card>

          <div className="rounded-[2.5rem] bg-gradient-to-br from-indigo-50/50 to-blue-50/50 p-8 text-slate-900 shadow-xl shadow-indigo-50 border border-white relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                 <div className="h-14 w-14 rounded-3xl bg-white shadow-lg flex items-center justify-center text-indigo-600 border border-slate-50">
                   <LayoutGrid size={28} />
                 </div>
                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">V4.2-STABLE</span>
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Authenticated User</p>
              <h4 className="text-2xl font-black mb-1">{user?.name || 'Employee'}</h4>
              <p className="text-sm text-indigo-600 font-bold mb-8 opacity-80">{user?.designation || 'Employee'}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/80 rounded-2xl p-4 shadow-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tenure</p>
                   <p className="text-lg font-black tracking-tight text-slate-900">
                     {user?.joinDate ? calculateTenure(user.joinDate) : 'N/A'}
                   </p>
                </div>
                <div className="bg-white/80 rounded-2xl p-4 shadow-sm">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clearance</p>
                   <p className="text-lg font-black tracking-tight text-slate-900">Level 4</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const calculateTenure = (joinDate: string): string => {
  try {
    const join = new Date(joinDate);
    const now = new Date();
    const years = now.getFullYear() - join.getFullYear();
    const months = now.getMonth() - join.getMonth();
    const totalMonths = years * 12 + months;
    
    if (totalMonths < 12) {
      return `${totalMonths} Mo`;
    } else {
      const yrs = Math.floor(totalMonths / 12);
      const mos = totalMonths % 12;
      return mos > 0 ? `${yrs}.${mos} Yrs` : `${yrs} Yrs`;
    }
  } catch {
    return 'N/A';
  }
};

const EarningStat = ({ label, value, color = "text-slate-900" }: { label: string; value: string; color?: string }) => (
  <div className="p-5 bg-white rounded-3xl border border-slate-50 transition-transform hover:scale-[1.02] shadow-sm">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-black ${color} tracking-tight`}>{value}</p>
  </div>
);

const NavWidget = ({ to, icon, label, desc, bgColor }: { to: string; icon: React.ReactNode; label: string; desc: string; bgColor: string }) => (
  <Link to={to} className="flex items-center justify-between p-5 rounded-3xl border border-white bg-white/40 hover:bg-white hover:shadow-xl hover:shadow-indigo-50/50 transition-all group">
    <div className="flex items-center space-x-4">
      <div className={`p-3 ${bgColor} rounded-[1.2rem] group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-black text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">{desc}</p>
      </div>
    </div>
    <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
  </Link>
);

export default Dashboard;
