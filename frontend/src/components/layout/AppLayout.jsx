import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation overlay"
          tabIndex={-1}
        />
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="px-4 pb-6 text-center text-[11px] text-slate-400">
          PayShield is a simulated payment platform. No real money moves through
          this application.
        </footer>
      </div>
    </div>
  );
}
