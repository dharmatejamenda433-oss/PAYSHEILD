import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  ReceiptText,
  Send,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import Brand from './Brand';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { cn } from '../../utils/cn';

const CUSTOMER_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transfer', label: 'Send money', icon: Send },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/admin/alerts', label: 'Fraud alerts', icon: ShieldAlert },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-navy-100/75 hover:bg-white/5 hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400 transition opacity-0',
              isActive && 'opacity-100'
            )}
          />
          <Icon
            className={cn(
              'h-4.5 w-4.5 shrink-0',
              isActive ? 'text-blue-300' : 'text-navy-200/70'
            )}
            aria-hidden="true"
          />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth();
  const { connected } = useRealtime();
  const location = useLocation();

  useEffect(() => {
    onClose();
    // Close the mobile drawer whenever the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-900 text-white transition-transform duration-300 lg:z-30 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <Brand />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-navy-200 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-8 px-3">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-300/70">
          {isAdmin ? 'Control centre' : 'Workspace'}
        </p>
        <nav className="mt-2 space-y-1">
          {(isAdmin ? ADMIN_LINKS : CUSTOMER_LINKS).map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onClose} />
          ))}
        </nav>
      </div>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-navy-100">
            <Activity className="h-3.5 w-3.5 text-blue-300" />
            Live monitoring
            <span
              className={cn(
                'ml-auto h-1.5 w-1.5 rounded-full',
                connected
                  ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]'
                  : 'bg-slate-500'
              )}
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-navy-300/80">
            {connected
              ? 'Connected to the PayShield event stream.'
              : 'Reconnecting to the event stream…'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {(user?.name || 'PS')
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              {user?.name}
            </p>
            <p className="truncate text-[11px] capitalize text-navy-300">
              {user?.role} account
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
