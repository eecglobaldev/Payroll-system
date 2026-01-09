import { Menu, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await api.employees.reload();
      alert('Employee data reloaded successfully!');
    } catch (error) {
      alert('Failed to reload employee data');
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <header className="h-16 glass-strong fixed top-0 right-0 left-0 lg:left-64 z-40 transition-all duration-300">
      <div className="flex items-center justify-between h-full px-6 lg:px-10">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block h-4 w-[1px] bg-white/10" />
          <h1 className="text-sm font-medium text-slate-400 uppercase tracking-widest">
            Management Portal
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleReload}
            disabled={isReloading}
            className="group flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all rounded-lg hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReloading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>Reload Systems</span>
          </button>
          
          <div className="h-8 w-[1px] bg-white/10" />
          
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none">Administrator</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter mt-1">Super User</p>
            </div>
            <div className="relative group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform cursor-pointer">
                AD
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

