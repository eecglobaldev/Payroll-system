import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Wallet,
  FileText,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Employees', to: '/employees', icon: Users },
  { name: 'Attendance', to: '/attendance', icon: Calendar },
  { name: 'Salary', to: '/salary', icon: Wallet },
  { name: 'Salary Summary', to: '/salary/summary', icon: FileText },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-[#0a0f1d]/80 backdrop-blur-2xl border-r border-white/5 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-8 border-b border-white/5">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">PAYROLL</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8 px-4">
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Core Navigation</p>
          <div className="space-y-1.5">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all group
                  ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="mr-3 h-[18px] w-[18px]" />
                    {item.name}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom left-0 right-0 p-6">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-semibold text-slate-300">v1.0.0 Stable</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

