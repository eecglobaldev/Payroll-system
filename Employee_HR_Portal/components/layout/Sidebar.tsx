
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Wallet, 
  CalendarDays, 
  CheckSquare, 
  BookOpen, 
  Info,
  ChevronDown
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  hasDropdown?: boolean;
}

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'To do', path: '/tasks', icon: <ClipboardList size={20} />, hasDropdown: true },
    { label: 'Salary', path: '/salary', icon: <Wallet size={20} />, hasDropdown: true },
    { label: 'Leave', path: '/leave', icon: <CalendarDays size={20} />, hasDropdown: true },
    { label: 'Attendance', path: '/attendance', icon: <CheckSquare size={20} />, hasDropdown: true },
    { label: 'Document Center', path: '/documents', icon: <BookOpen size={20} /> },
    { label: 'Helpdesk', path: '/helpdesk', icon: <Info size={20} /> },
  ];

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-40 w-72 bg-white/60 backdrop-blur-3xl border-r border-white/50 transition-all duration-500 lg:static lg:translate-x-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/5 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        ></div>
      )}

      <aside className={sidebarClasses}>
        <div className="flex flex-col h-full">
          <div className="h-24 flex items-center px-8">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                <img 
                  src="/EECLOGORED.png" 
                  alt="EEC Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tighter">EEC<span className="text-indigo-600"> HR Portal</span></span>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center justify-between px-4 py-3.5 text-sm font-bold rounded-2xl transition-all group
                  ${isActive 
                    ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100/50' 
                    : 'text-slate-500 hover:bg-white hover:text-indigo-600'}
                `}
              >
                <div className="flex items-center">
                  <span className={`mr-4 transition-transform group-hover:scale-110 ${window.location.hash.includes(item.path) ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                {item.hasDropdown && (
                  <ChevronDown size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-6">
            <div className="rounded-[2rem] bg-indigo-50/50 border border-indigo-100/50 p-6">
               <div className="flex items-center space-x-3 mb-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Status</span>
               </div>
               <p className="text-xs font-bold text-slate-700 mb-4 leading-relaxed">System v4.2 fully synchronized with global node.</p>
               {/* <button className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95">
                 View Log
               </button> */}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
