
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, LogOut, Bell, Search, Command } from 'lucide-react';

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-3xl border-b border-white/50 px-6">
      <div className="max-w-7xl mx-auto h-24 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button
            type="button"
            className="lg:hidden p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all"
            onClick={onMenuClick}
          >
            <Menu size={24} strokeWidth={2.5} />
          </button>
          
          <div className="hidden lg:flex items-center px-6 py-3 bg-white/50 border border-slate-100 rounded-[1.5rem] group focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
             <Search size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
             <input 
               type="text" 
               placeholder="System Search..." 
               className="bg-transparent border-none outline-none text-sm px-4 w-64 text-slate-700 placeholder:text-slate-300 font-bold tracking-wide"
             />
             <div className="flex items-center space-x-1 text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                <Command size={10} />
                <span>K</span>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 mr-4">
            <HeaderAction icon={<Bell size={20} />} hasBadge />
          </div>
          
          <div className="h-10 w-px bg-slate-200/50 hidden sm:block"></div>

          <div className="flex items-center pl-4 group cursor-pointer">
            <div className="hidden sm:flex flex-col items-end mr-4">
              <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{user?.name}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">{user?.designation}</span>
            </div>
            <div className="h-12 w-12 rounded-[1.2rem] bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xl shadow-indigo-100 ring-4 ring-white group-hover:scale-105 transition-all">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>

          <button 
            onClick={logout}
            className="ml-4 p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all group"
            title="Secure Logout"
          >
            <LogOut size={20} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
};

const HeaderAction = ({ icon, hasBadge }: { icon: React.ReactNode; hasBadge?: boolean }) => (
  <button className="relative p-3.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all group">
    {icon}
    {hasBadge && (
      <span className="absolute top-3.5 right-3.5 h-2.5 w-2.5 bg-indigo-500 rounded-full border-2 border-white shadow-sm"></span>
    )}
  </button>
);

export default Header;
