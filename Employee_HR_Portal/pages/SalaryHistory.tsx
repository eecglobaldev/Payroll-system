import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { getSalaryHistory, downloadPayslip } from '../services/api';
import { SalaryRecord, SalaryStatus } from '../types';
import { Download, FileText, Filter, SlidersHorizontal, AlertCircle } from 'lucide-react';

const SalaryHistory: React.FC = () => {
  const [history, setHistory] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSalaryHistory();
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch salary history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load salary history');
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, []);

  const handleDownload = async (record: SalaryRecord) => {
    // Check if salary is on HOLD - show message but don't block UI
    if (record.status === SalaryStatus.HOLD) {
      alert('Salary is on HOLD. Please contact HR for more information.');
      return;
    }

    try {
      setDownloading(record.id);
      // Extract month in YYYY-MM format from record
      // The record.id should be in YYYY-MM format
      const month = record.id.includes('-') 
        ? record.id 
        : `${record.year}-${String(new Date(`${record.month} 1, ${record.year}`).getMonth() + 1).padStart(2, '0')}`;
      
      await downloadPayslip(month);
    } catch (err) {
      console.error('Failed to download payslip:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to download payslip';
      alert(errorMessage);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Earnings Ledger</h1>
          <p className="text-slate-400 font-semibold tracking-wide">Detailed audit of all historical disbursements.</p>
        </div>
        <div className="flex space-x-3">
           <Button variant="secondary" size="md">
             <SlidersHorizontal size={18} className="mr-2" />
             Analytical View
           </Button>
           <Button variant="primary" size="md">
             Inquire Finance
           </Button>
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

      <Card className="!px-0 !py-0 border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/40 backdrop-blur-md border-b border-slate-100">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Billing Cycle</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Base Allocation</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Net Realized</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">State</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-10 py-8">
                        <div className="h-5 bg-slate-100 rounded-xl w-full"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-12 text-center">
                    <p className="text-slate-400 font-semibold">No salary records found</p>
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-indigo-50/30 transition-all group">
                    <td className="px-10 py-8">
                      <p className="text-lg font-black text-slate-900">{record.month} {record.year}</p>
                    </td>
                    <td className="px-10 py-8">
                      <p className="text-base font-bold text-slate-500">₹{Math.round(record.grossSalary).toLocaleString()}</p>
                    </td>
                    <td className="px-10 py-8">
                      <p className="text-xl font-black text-indigo-600">₹{Math.round(record.netSalary).toLocaleString()}</p>
                    </td>
                    <td className="px-10 py-8">
                      <Badge variant={record.status === SalaryStatus.PAID ? 'success' : 'danger'}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-10 py-8">
                      <button
                        onClick={() => handleDownload(record)}
                        disabled={record.status === SalaryStatus.HOLD || downloading === record.id}
                        className={`inline-flex items-center text-xs font-black uppercase tracking-widest transition-all ${
                          record.status === SalaryStatus.HOLD 
                            ? 'text-slate-300 cursor-not-allowed' 
                            : downloading === record.id
                            ? 'text-slate-400 cursor-wait'
                            : 'text-indigo-500 hover:text-indigo-700 hover:scale-105'
                        }`}
                      >
                        <Download size={16} className="mr-2" />
                        {downloading === record.id ? 'Downloading...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="bg-white/40 backdrop-blur-3xl border border-white rounded-[2.5rem] p-10 flex items-start space-x-8 shadow-sm">
        <div className="p-6 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100">
          <FileText size={32} strokeWidth={2.5} />
        </div>
        <div className="space-y-3">
          <h4 className="text-xl font-black text-slate-900 tracking-tight">Compliance & Policy Overview</h4>
          <p className="text-sm text-slate-500 font-bold leading-relaxed opacity-80 max-w-3xl">
            System generated earnings are disbursed on the final operational day of the cycle. 
            Discrepancy reports must be filed within a 48-hour analytical window post-disbursement.
          </p>
          <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">Download Comprehensive Guide</button>
        </div>
      </div>
    </div>
  );
};

export default SalaryHistory;
