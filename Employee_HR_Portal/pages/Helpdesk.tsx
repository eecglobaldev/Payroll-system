
import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { MessageSquare, LifeBuoy, Search, ExternalLink, Send } from 'lucide-react';

const Helpdesk: React.FC = () => {
  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Helpdesk Core</h1>
          <p className="text-slate-400 font-semibold tracking-wide">Direct support for payroll, tech, and HR inquiries.</p>
        </div>
        <Button variant="primary" size="lg" className="rounded-3xl">
          <Send size={20} className="mr-2" /> Raise New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Your Support Tickets" className="border-none">
             <div className="space-y-4">
               <TicketRow subject="Payroll Discrepancy - May 2024" id="#TK-9042" status="Open" date="2h ago" category="Finance" />
               <TicketRow subject="MacBook M3 Battery Drain Issues" id="#TK-8831" status="Resolved" date="4d ago" category="IT Tech" />
               <TicketRow subject="Query regarding Health Insurance Top-up" id="#TK-8712" status="In Progress" date="1w ago" category="Benefits" />
             </div>
          </Card>

          <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white flex items-center justify-between relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-125 transition-transform duration-700"><LifeBuoy size={120} /></div>
             <div className="space-y-2 relative z-10">
               <h4 className="text-xl font-black tracking-tight">Need Real-time Assistance?</h4>
               <p className="text-sm font-bold text-indigo-100 opacity-80">Our HR live chat bots are available 24/7 for quick policy queries.</p>
             </div>
             <button className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-black text-sm shadow-xl relative z-10 hover:-translate-y-1 transition-all">
               Start Chat
             </button>
          </div>
        </div>

        <div className="space-y-8">
          <Card title="Knowledge Base">
             <div className="space-y-4">
               <KBItem title="Resetting Work Passcode" />
               <KBItem title="Understanding Tax Deductions" />
               <KBItem title="Claiming Remote Allowances" />
               <KBItem title="Employee Referral Program" />
               <button className="w-full mt-4 text-xs font-black text-indigo-600 uppercase tracking-widest text-center hover:underline">Browse All Articles</button>
             </div>
          </Card>

          <Card variant="glass" className="bg-white/20 border-slate-100">
             <div className="flex flex-col items-center text-center p-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl mb-4"><LifeBuoy size={32} /></div>
                <h4 className="text-sm font-black text-slate-900 mb-1">Emergency Support</h4>
                <p className="text-xs font-bold text-slate-400 mb-6">Critical system failures only.</p>
                <p className="text-lg font-black text-indigo-600 tracking-tight">+1 (800) HR-CORE</p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const TicketRow = ({ subject, id, status, date, category }: any) => (
  <div className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl flex items-center justify-between hover:bg-white transition-all group">
    <div className="flex items-center space-x-4">
      <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-indigo-50 transition-colors"><MessageSquare size={20} className="text-slate-400 group-hover:text-indigo-600" /></div>
      <div>
        <h5 className="text-sm font-black text-slate-900 mb-1">{subject}</h5>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{id} • {category} • {date}</p>
      </div>
    </div>
    <Badge variant={status === 'Open' ? 'info' : status === 'Resolved' ? 'success' : 'warning'}>{status}</Badge>
  </div>
);

const KBItem = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:translate-x-1 transition-transform cursor-pointer group">
    <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">{title}</span>
    <ExternalLink size={14} className="text-slate-300" />
  </div>
);

export default Helpdesk;
