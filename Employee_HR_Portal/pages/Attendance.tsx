import React, { useEffect, useState, useMemo } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { getAttendanceData } from '../services/api';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';

const Attendance: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<{ summary: any; dailyBreakdown: AttendanceRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAttendanceData(selectedMonth);
        setAttendanceData(data);
      } catch (err) {
        console.error('Failed to fetch attendance:', err);
        setError(err instanceof Error ? err.message : 'Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedMonth]);

  // Filter attendance to show only dates up to current date
  const filteredAttendance = useMemo(() => {
    if (!attendanceData) return null;
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include entire current day
    
    const filteredBreakdown = attendanceData.dailyBreakdown.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate <= today;
    });
    
    // Recalculate summary based on filtered data
    const filteredSummary = {
      fullDays: filteredBreakdown.filter(d => d.status === AttendanceStatus.PRESENT).length,
      halfDays: filteredBreakdown.filter(d => d.status === AttendanceStatus.HALF).length,
      absentDays: filteredBreakdown.filter(d => d.status === AttendanceStatus.ABSENT).length,
      lateDays: filteredBreakdown.filter(d => d.isLate).length,
      earlyExits: filteredBreakdown.filter(d => d.isEarlyExit).length,
      totalWorkedHours: filteredBreakdown.reduce((sum, d) => sum + (d.totalHours || 0), 0),
    };
    
    return {
      ...attendanceData,
      summary: filteredSummary,
      dailyBreakdown: filteredBreakdown,
    };
  }, [attendanceData]);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT: return <Badge variant="success">Present</Badge>;
      case AttendanceStatus.ABSENT: return <Badge variant="danger">Absent</Badge>;
      case AttendanceStatus.LEAVE: return <Badge variant="warning">Leave</Badge>;
      case AttendanceStatus.HALF: return <Badge variant="neutral">Half Day</Badge>;
      case AttendanceStatus.WEEK_OFF: return <Badge variant="info">Week Off</Badge>;
      default: return null;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return '—';
    try {
      // Parse ISO string (same approach as admin portal)
      // The backend returns ISO strings like "2025-12-26T09:00:00.000Z"
      const date = new Date(timeStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('[Attendance] Invalid date:', timeStr);
        return '—';
      }
      
      // Format as HH:mm (24-hour format like admin portal)
      // Use local time (getHours/getMinutes already return local time)
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('[Attendance] Error formatting time:', timeStr, error);
      return '—';
    }
  };

  const formatHours = (hours: number): string => {
    if (hours === 0) return '—';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Attendance Log</h1>
          <p className="text-slate-400 font-semibold tracking-wide">Biometric logs and presence monitoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-sm font-semibold text-slate-700">Billing Period:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
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

      {loading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredAttendance ? (
        <>
          {/* Leave & Regularization Summary */}
          {(() => {
            const plDates = filteredAttendance.dailyBreakdown.filter(d => d.isPaidLeave).map(d => d.date);
            const clDates = filteredAttendance.dailyBreakdown.filter(d => d.isCasualLeave).map(d => d.date);
            const regDates = filteredAttendance.dailyBreakdown.filter(d => d.isRegularized).map(d => ({
              date: d.date,
              originalStatus: d.regularizationOriginalStatus || 'N/A'
            }));
            
            if (plDates.length > 0 || clDates.length > 0 || regDates.length > 0) {
              return (
                <Card title="Leave & Regularization Summary" className="!px-6 !py-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plDates.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Paid Leave ({plDates.length} day{plDates.length !== 1 ? 's' : ''})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {plDates.map(date => (
                            <span key={date} className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {clDates.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          Casual Leave ({clDates.length} day{clDates.length !== 1 ? 's' : ''})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {clDates.map(date => (
                            <span key={date} className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {regDates.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-green-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Regularized ({regDates.length} day{regDates.length !== 1 ? 's' : ''})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {regDates.map(({ date, originalStatus }) => (
                            <span key={date} className="px-2 py-1 rounded-md bg-green-50 text-green-700 text-[10px] font-bold border border-green-200" title={`Original: ${originalStatus}`}>
                              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            }
            return null;
          })()}

          {/* Analytics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { label: 'Standard Shifts', val: filteredAttendance.summary.fullDays, color: 'text-emerald-600' },
              { label: 'Partial Presence', val: filteredAttendance.summary.halfDays, color: 'text-amber-600' },
              { label: 'Absence Events', val: filteredAttendance.summary.absentDays, color: 'text-rose-600' },
              { label: 'Late Entries', val: filteredAttendance.summary.lateDays, color: 'text-orange-600' },
              { label: 'Premature Exits', val: filteredAttendance.summary.earlyExits, color: 'text-indigo-600' },
              { label: 'Aggregate Hours', val: filteredAttendance.summary.totalWorkedHours.toFixed(1), color: 'text-violet-600' },
            ].map((stat, idx) => (
              <Card key={idx} className="!px-6 !py-6 text-center border border-slate-100">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.val}</p>
              </Card>
            ))}
          </div>

          {/* Detailed Logs Table */}
          <Card title="Operational Attendance Ledger" className="!px-0 !py-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/40 backdrop-blur-md border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timestamp</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">First In</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Last Out</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Duration</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Leave/Regularization</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAttendance.dailyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-8 py-12 text-center">
                        <p className="text-slate-400 font-semibold">No attendance records found for this month</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.dailyBreakdown.map((day) => (
                      <tr key={day.date} className="hover:bg-indigo-50/30 transition-all group">
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-900 font-bold">
                          {formatDate(day.date)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-600 font-semibold">
                          {formatTime(day.firstEntry)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-600 font-semibold">
                          {formatTime(day.lastExit)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-900 font-bold">
                          {day.totalHours && day.totalHours > 0 ? formatHours(day.totalHours) : '—'}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          {getStatusBadge(day.status)}
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            {day.isPaidLeave && (
                              <span className="px-3 py-1 rounded-lg bg-blue-500/15 text-blue-700 text-xs font-black uppercase tracking-wider border border-blue-500/30 shadow-sm">
                                Paid Leave (PL)
                              </span>
                            )}
                            {day.isCasualLeave && (
                              <span className="px-3 py-1 rounded-lg bg-purple-500/15 text-purple-700 text-xs font-black uppercase tracking-wider border border-purple-500/30 shadow-sm">
                                Casual Leave (CL)
                              </span>
                            )}
                            {day.isRegularized && (
                              <span className="px-3 py-1 rounded-lg bg-green-500/15 text-green-700 text-xs font-black uppercase tracking-wider border border-green-500/30 shadow-sm">
                                {day.regularizationOriginalStatus 
                                  ? `Regularized (${day.regularizationOriginalStatus.toUpperCase()})`
                                  : 'Regularized'}
                              </span>
                            )}
                            {!day.isPaidLeave && !day.isCasualLeave && !day.isRegularized && (
                              <span className="text-slate-400 text-xs font-semibold">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            {day.isLate && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                                {day.minutesLate ? `Late (${day.minutesLate}m)` : 'Late'}
                              </span>
                            )}
                            {day.isEarlyExit && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                                Early Exit
                              </span>
                            )}
                            {!day.isLate && !day.isEarlyExit && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default Attendance;
