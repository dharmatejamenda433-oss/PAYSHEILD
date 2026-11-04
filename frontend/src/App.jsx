import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute, { RoleRoute } from './components/layout/ProtectedRoute';
import FullPageLoader from './components/ui/FullPageLoader';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/customer/DashboardPage';
import TransferPage from './pages/customer/TransferPage';
import TransactionsPage from './pages/customer/TransactionsPage';
import TransactionDetailPage from './pages/customer/TransactionDetailPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage';
import FraudAlertsPage from './pages/admin/FraudAlertsPage';
import InvestigationPage from './pages/admin/InvestigationPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './context/AuthContext';

function roleHome(role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

function RootRedirect() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <FullPageLoader message="Opening PayShield…" />;
  }

  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}

function PublicOnly({ children }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <FullPageLoader message="Checking your session…" />;
  }

  if (user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<RoleRoute role="customer" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route
              path="/transactions/:id"
              element={<TransactionDetailPage />}
            />
          </Route>

          <Route element={<RoleRoute role="admin" />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route
              path="/admin/transactions"
              element={<AdminTransactionsPage />}
            />
            <Route path="/admin/alerts" element={<FraudAlertsPage />} />
            <Route
              path="/admin/investigations/:id"
              element={<InvestigationPage />}
            />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
          </Route>

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
