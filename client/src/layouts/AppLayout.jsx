import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { GroupProvider } from '../context/GroupContext';
import {
  LayoutDashboard,
  LogOut,
  Zap,
} from 'lucide-react';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  return (
    <GroupProvider>
      <div className="min-h-screen flex flex-col lg:flex-row bg-nebula-bg text-nebula-text">
        {/* Sidebar for Desktop */}
        <aside className="hidden lg:flex w-[260px] bg-nebula-bg border-r border-nebula-border flex-col fixed inset-y-0 left-0">
          {/* Logo */}
          <div className="h-20 flex items-center gap-3 px-6 border-b border-nebula-border">
            <Zap className="w-6 h-6 text-nebula-primary fill-nebula-primary" />
            <span className="text-xl font-bold tracking-wider text-white">
              Split<span className="text-nebula-primary">Ledger</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 rounded-lg group
                  ${
                    isActive
                      ? 'text-nebula-primary border-l-4 border-nebula-primary bg-nebula-primary/5 pl-3'
                      : 'text-nebula-muted hover:text-nebula-primary hover:bg-nebula-primary/5 border-l-4 border-transparent hover:border-nebula-primary/30 pl-3'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-nebula-border bg-nebula-card/40">
            <div className="flex items-center gap-3">
              {/* User Avatar with gradient background (accent to primary) */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nebula-accent to-nebula-primary flex items-center justify-center text-nebula-bg font-bold text-base shadow-md">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-nebula-muted truncate">
                  {user?.email || ''}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-nebula-muted hover:text-nebula-accent hover:bg-nebula-accent/10 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Top Header */}
        <header className="lg:hidden h-16 flex items-center justify-between px-6 bg-nebula-bg border-b border-nebula-border sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-nebula-primary fill-nebula-primary" />
            <span className="text-lg font-bold text-white tracking-wider">
              Split<span className="text-nebula-primary">Ledger</span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-nebula-muted hover:text-nebula-accent transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page Content area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px] pb-20 lg:pb-0">
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Bottom Nav Bar for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-nebula-bg border-t border-nebula-border flex-col justify-around z-30 px-4 shadow-lg flex">
          <div className="flex items-center justify-around w-full">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 text-xs font-semibold py-1 transition-all duration-200
                  ${isActive ? 'text-nebula-primary' : 'text-nebula-muted hover:text-nebula-primary'}`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            
            <div className="flex flex-col items-center gap-1 text-xs font-semibold py-1 text-nebula-muted">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nebula-accent to-nebula-primary flex items-center justify-center text-nebula-bg font-bold text-[10px] shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span>{user?.name?.split(' ')[0] || 'Profile'}</span>
            </div>
          </div>
        </div>
      </div>
    </GroupProvider>
  );
}
