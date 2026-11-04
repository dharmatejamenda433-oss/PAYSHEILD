import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FullPageLoader from '../ui/FullPageLoader';

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <FullPageLoader message="Restoring your secure session…" />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

export function RoleRoute({ role }) {
  const { user } = useAuth();

  if (user && user.role !== role) {
    return (
      <Navigate
        to={user.role === 'admin' ? '/admin' : '/dashboard'}
        replace
      />
    );
  }

  return <Outlet />;
}
