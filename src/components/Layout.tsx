import React from 'react';
import { useAuth } from './AuthProvider';
import { useVobiz } from './VobizProvider';
import { 
  Phone, 
  History, 
  Users, 
  Settings, 
  ShieldCheck, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab }) => {
  const { profile, logout } = useAuth();
  const { status } = useVobiz();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'phone', label: 'Phone', icon: Phone },
    { id: 'logs', label: 'Call Logs', icon: History },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-surface border-r border-border">
        <div className="px-6 py-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-extrabold text-lg">
            U
          </div>
          <span className="font-extrabold text-xl text-primary tracking-tight">UdyamNX</span>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              className={cn(
                "sleek-nav-item w-full",
                activeTab === item.id && "active"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="bg-[#f1f5f9] rounded-xl p-4 mb-6">
            <p className="text-[0.75rem] text-text-muted mb-1">VOBIZ Status</p>
            <p className={cn(
              "text-[0.85rem] font-semibold flex items-center gap-2 capitalize",
              status === 'registered' ? "text-success" : 
              status === 'failed' ? "text-danger" : "text-text-muted"
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                status === 'registered' ? "bg-success animate-pulse" : 
                status === 'failed' ? "bg-danger" : "bg-text-muted"
              )} />
              {status}
            </p>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-text-muted hover:text-danger hover:bg-red-50 gap-3 rounded-xl px-4"
            onClick={logout}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-16 bg-surface border-b border-border px-6 md:px-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 -ml-2 text-text-muted hover:bg-bg rounded-lg"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
            <h2 className="text-lg font-semibold text-text-main">
              {navItems.find(i => i.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <span className="sleek-badge hidden sm:inline-block">{profile?.role} Role</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:text-right">
              <p className="text-[0.85rem] font-bold text-text-main leading-none">{profile?.displayName}</p>
              <p className="text-[0.75rem] text-text-muted mt-1 capitalize">{profile?.role} Admin</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {profile?.displayName?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-white pt-16">
            <nav className="p-6 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(`/${item.id}`);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl text-lg font-medium",
                    activeTab === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </button>
              ))}
              <div className="pt-6 mt-6 border-t border-slate-100">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-slate-600 p-4 text-lg gap-4"
                  onClick={logout}
                >
                  <LogOut className="w-6 h-6" />
                  Logout
                </Button>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden flex bg-white border-t border-slate-200 pb-safe">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              className={cn(
                "flex-1 flex flex-col items-center py-3 gap-1",
                activeTab === item.id ? "text-blue-600" : "text-slate-400"
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
