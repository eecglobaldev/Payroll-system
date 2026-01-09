
import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { FileText, Download, Shield, Eye, Search, Filter } from 'lucide-react';

const DocumentCenter: React.FC = () => {
  return (
    <div className="space-y-10 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Artifact Repository</h1>
          <p className="text-slate-400 font-semibold tracking-wide">Secure access to payslips, policies, and contracts.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" size="md">
            <Filter size={18} className="mr-2" /> Category
          </Button>
          <div className="px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200 rounded-2xl flex items-center space-x-3">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Search files..." className="bg-transparent border-none outline-none text-sm font-bold w-40" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DocTypeCard icon={<FileText />} label="Payslips" count={24} />
        <DocTypeCard icon={<Shield />} label="Tax Forms" count={3} />
        <DocTypeCard icon={<FileText className="text-blue-500" />} label="Policies" count={12} />
        <DocTypeCard icon={<Shield className="text-emerald-500" />} label="Contracts" count={1} />
      </div>

      <Card title="Recent Artifacts" className="border-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DocumentItem name="Employee_Handbook_2024.pdf" date="Mar 12, 2024" size="2.4 MB" category="Policy" />
          <DocumentItem name="Salary_Slip_May_2024.pdf" date="May 31, 2024" size="420 KB" category="Payroll" />
          <DocumentItem name="Insurance_Benefit_Guide.pdf" date="Jan 15, 2024" size="1.8 MB" category="Benefits" />
          <DocumentItem name="Code_of_Conduct_v2.pdf" date="Feb 02, 2024" size="980 KB" category="Legal" />
          <DocumentItem name="Tax_Form_16_FY23.pdf" date="Apr 10, 2024" size="1.2 MB" category="Tax" />
        </div>
      </Card>
    </div>
  );
};

const DocTypeCard = ({ icon, label, count }: any) => (
  <button className="bg-white/60 backdrop-blur-xl p-6 rounded-[2rem] border border-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all text-left group">
    <div className="p-3 bg-slate-50 rounded-2xl w-fit mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
      {icon}
    </div>
    <h4 className="text-sm font-black text-slate-900 mb-1">{label}</h4>
    <p className="text-xs font-bold text-slate-400">{count} Documents</p>
  </button>
);

const DocumentItem = ({ name, date, size, category }: any) => (
  <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl flex items-start justify-between group hover:bg-white hover:shadow-lg transition-all">
    <div className="flex space-x-4">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500"><FileText size={24} /></div>
      <div>
        <p className="text-sm font-black text-slate-900 truncate w-40">{name}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{date} • {size}</p>
        <div className="mt-2 text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">{category}</div>
      </div>
    </div>
    <div className="flex space-x-2">
      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Eye size={18} /></button>
      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Download size={18} /></button>
    </div>
  </div>
);

export default DocumentCenter;
