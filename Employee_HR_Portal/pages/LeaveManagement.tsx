
import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { CalendarDays, Plus, Clock, History, Plane } from 'lucide-react';

const LeaveManagement: React.FC = () => {
  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Time Off Control</h1>
          <p className="text-slate-400 font-semibold tracking-wide">Manage your leave entitlements and requests.</p>
        </div>
        <Button variant="primary" size="lg" className="rounded-3xl">
          <Plus size={20} className="mr-2" /> Submit New Request
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BalanceCard label="Annual Leave" current={14} total={24} color="bg-indigo-600" />
        <BalanceCard label="Medical/Sick" current={8} total={12} color="bg-emerald-500" />
        <BalanceCard label="Casual Leave" current={2} total={4} color="bg-blue-400" />
      </div>

      <Card title="Active & Recent Requests" className="border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Days</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <LeaveRow type="Vacation" dates="Jun 12 - Jun 15, 2024" days={4} status="Approved" />
              <LeaveRow type="Sick Leave" dates="May 20 - May 21, 2024" days={2} status="Approved" />
              <LeaveRow type="Casual" dates="Jul 04, 2024" days={1} status="Pending" />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const BalanceCard = ({ label, current, total, color }: { label: string, current: number, total: number, color: string }) => (
  <Card variant="glass" className="relative group overflow-hidden border-none shadow-none ring-1 ring-slate-100">
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <Plane size={20} className="text-slate-300" />
      </div>
      <div className="flex items-baseline space-x-2 mb-4">
        <span className="text-4xl font-black text-slate-900">{current}</span>
        <span className="text-slate-400 font-bold">/ {total} Days</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-1000`} 
          style={{ width: `${(current/total)*100}%` }}
        ></div>
      </div>
    </div>
  </Card>
);

const LeaveRow = ({ type, dates, days, status }: any) => (
  <tr className="hover:bg-indigo-50/20 transition-all">
    <td className="px-8 py-6">
      <div className="flex items-center">
        <div className="p-2 bg-slate-50 rounded-xl mr-3"><CalendarDays size={16} className="text-slate-400" /></div>
        <p className="text-sm font-black text-slate-900">{type}</p>
      </div>
    </td>
    <td className="px-8 py-6 text-sm font-bold text-slate-500">{dates}</td>
    <td className="px-8 py-6 text-sm font-black text-slate-900">{days} Days</td>
    <td className="px-8 py-6">
      <Badge variant={status === 'Approved' ? 'success' : status === 'Pending' ? 'warning' : 'danger'}>
        {status}
      </Badge>
    </td>
    <td className="px-8 py-6">
      <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">Details</button>
    </td>
  </tr>
);

export default LeaveManagement;
