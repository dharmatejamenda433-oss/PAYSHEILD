import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCheck,
  ChevronDown,
  Gavel,
  LogOut,
  Menu,
  ShieldAlert,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { formatInr, getInitials, relativeTime } from '../../utils/format';
import { cn } from '../../utils/cn';

const KIND_ICONS = {
  incoming: { icon: ArrowDownLeft, classes: 'bg-emerald-50 text-emerald-600' },
  outgoing: { icon: ArrowUpRight, classes: 'bg-blue-50 text-blue-600' },
  risk: { icon: ShieldAlert, classes: 'bg-amber-50 text-amber-600' },
  'fraud-alert': { icon: ShieldAlert, classes: 'bg-amber-50 text-amber-600' },
  review: { icon: Gavel, classes: 'bg-blue-50 text-blue-600' },
};

export default function Topbar({ onOpenSidebar }) {
  const { user, account, isCustomer, logout } = useAuth();
  const { connected, notifications, unreadCount, markAllRead, clearNotifications } =
    useRealtime();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const rightClusterRef = useRef(null);

  useEffect(() => {
    setBellOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rightClusterRef.current?.contains(event.target)) {
        setBellOpen(false);
        setUserOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleNotificationClick(notification) {
    setBellOpen(false);
    if (!notification.transactionRef) return;

    navigate(
      user?.role === 'admin'
        ? `/admin/investigations/${notification.transactionRef}`
        : `/transactions/${notification.transactionRef}`
    );
  }

  function handleLogout() {
    setUserOpen(false);
    logout();
    toast.info('Signed out', 'Your PayShield session has ended.');
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              connected
                ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
                : 'bg-slate-400'
            )}
          />
          {connected ? 'Live monitoring' : 'Reconnecting'}
        </div>

        <div
          ref={rightClusterRef}
          className="ml-auto flex items-center gap-2 sm:gap-3"
        >
          {isCustomer && account ? (
            <Link
              to="/transfer"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-blue-200 hover:bg-blue-50/50 sm:flex"
            >
              <Wallet className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-slate-500">Wallet</span>
              <span className="font-semibold text-slate-900">
                {formatInr(account.balance)}
              </span>
            </Link>
          ) : (
            <span className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:block">
              Admin console
            </span>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setBellOpen((open) => !open);
                setUserOpen(false);
              }}
              className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
              aria-expanded={bellOpen}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>

            {bellOpen ? (
              <div className="animate-rise absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lifted">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Notifications
                    </p>
                    <p className="text-xs text-slate-500">
                      Live account and risk events
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {notifications.length ? (
                      <>
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="Mark all as read"
                          aria-label="Mark all notifications as read"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={clearNotifications}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                          title="Clear notifications"
                          aria-label="Clear notifications"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length ? (
                    <ul className="divide-y divide-slate-100">
                      {notifications.map((notification) => {
                        const config =
                          KIND_ICONS[notification.kind] || {
                            icon: Bell,
                            classes: 'bg-slate-100 text-slate-500',
                          };
                        const Icon = config.icon;

                        return (
                          <li key={notification.id}>
                            <button
                              type="button"
                              onClick={() =>
                                handleNotificationClick(notification)
                              }
                              className={cn(
                                'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                                !notification.read && 'bg-blue-50/40'
                              )}
                            >
                              <span
                                className={cn(
                                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                  config.classes
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="truncate text-sm font-medium text-slate-900">
                                    {notification.title}
                                  </span>
                                  {!notification.read ? (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                                  {notification.message}
                                </span>
                                <span className="mt-1 block text-[11px] text-slate-400">
                                  {relativeTime(notification.receivedAt)}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <Bell className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No notifications yet
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Payment and risk events appear here in real time.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserOpen((open) => !open);
                setBellOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-slate-100"
              aria-expanded={userOpen}
              aria-label="Account menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                {getInitials(user?.name)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-semibold text-slate-800">
                  {user?.name}
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {user?.role}
                </span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </button>

            {userOpen ? (
              <div className="animate-rise absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lifted">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile & security
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
