import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api, { apiData } from '../services/api';
import { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../utils/constants';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const toast = useToast();

  const applySession = useCallback((session) => {
    if (session?.token) {
      localStorage.setItem(TOKEN_KEY, session.token);
    }
    setUser(session?.user || null);
    setAccount(session?.account || null);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setAccount(null);
  }, []);

  // Restore the session on a page refresh by asking the API who the token
  // belongs to. The backend never trusts a cached role from the browser.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const response = await api.get('/auth/profile');
        const data = apiData(response);

        if (!cancelled) {
          setUser(data.user);
          setAccount(data.account);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      toast.warning('Session expired', 'Please sign in again to continue.');
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession, toast]);

  const login = useCallback(
    async (credentials) => {
      const response = await api.post('/auth/login', credentials);
      const session = apiData(response);
      applySession(session);
      return session;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const response = await api.post('/auth/register', payload);
      const session = apiData(response);
      applySession(session);
      return session;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    const response = await api.get('/auth/profile');
    const data = apiData(response);
    setUser(data.user);
    setAccount(data.account);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      initializing,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isCustomer: user?.role === 'customer',
      login,
      register,
      logout,
      refreshProfile,
      setAccount,
    }),
    [
      user,
      account,
      initializing,
      login,
      register,
      logout,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
