import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen relative flex bg-[#0f172a]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 pt-16 relative min-h-screen overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 lg:p-10 space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

