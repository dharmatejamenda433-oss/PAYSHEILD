import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createSocket } from '../services/socket';
import { TOKEN_KEY } from '../utils/constants';
import { formatInr } from '../utils/format';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeContext = createContext(null);

function newId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Owns the Socket.IO connection for the signed-in user.
 *
 * It exposes two things:
 *  - `event`: the latest server event, so pages can refetch their data.
 *  - `notifications`: a small in-memory inbox shown in the top bar.
 *
 * The backend decides which rooms a socket joins, so a customer can never
 * receive another customer's payment events.
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [event, setEvent] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sequence = useRef(0);

  const publish = useCallback((type, payload) => {
    sequence.current += 1;
    setEvent({ type, payload, sequence: sequence.current });
  }, []);

  const addNotification = useCallback((notification) => {
    const item = {
      id: newId(),
      receivedAt: new Date().toISOString(),
      read: false,
      ...notification,
    };

    setNotifications((current) => [item, ...current].slice(0, 30));
    setUnreadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      setEvent(null);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return undefined;

    const socket = createSocket(token);

    function handleCreated(payload) {
      const transaction = payload?.transaction;
      if (!transaction) return;

      publish('transaction:created', payload);

      if (user.role === 'admin') {
        if (
          transaction.riskLevel === 'MEDIUM' ||
          transaction.riskLevel === 'HIGH'
        ) {
          addNotification({
            kind: 'risk',
            title: 'Suspicious payment detected',
            message: `${transaction.transactionId} · ${formatInr(
              transaction.amount
            )} · ${transaction.riskLevel} risk (${transaction.riskScore}/100)`,
            tone: 'warning',
            transactionRef: transaction.transactionId,
          });
        }
        return;
      }

      if (transaction.direction === 'INCOMING') {
        addNotification({
          kind: 'incoming',
          title: 'Payment received',
          message: `${formatInr(transaction.amount)} from ${
            transaction.sender?.name || 'a PayShield customer'
          }`,
          tone: 'success',
          transactionRef: transaction.transactionId,
        });
        toast.success(
          'Payment received',
          `${formatInr(transaction.amount)} was added to your wallet.`
        );
        return;
      }

      if (transaction.direction === 'OUTGOING') {
        const statusMessages = {
          COMPLETED: 'Transfer completed',
          PENDING_REVIEW: 'Transfer is under review',
          DECLINED: 'Transfer declined',
          FAILED: 'Transfer failed',
          APPROVED: 'Transfer approved',
        };

        addNotification({
          kind: 'outgoing',
          title: statusMessages[transaction.status] || 'Transfer updated',
          message: `${formatInr(transaction.amount)} to ${
            transaction.receiver?.name || 'recipient'
          }`,
          tone:
            transaction.status === 'COMPLETED'
              ? 'success'
              : transaction.status === 'PENDING_REVIEW'
                ? 'warning'
                : 'error',
          transactionRef: transaction.transactionId,
        });
      }
    }

    function handleReviewed(payload) {
      const transaction = payload?.transaction;
      const decision = payload?.decision;

      publish('transaction:reviewed', payload);

      if (!transaction) return;

      if (user.role === 'admin') {
        addNotification({
          kind: 'review',
          title:
            decision === 'APPROVED'
              ? 'Payment approved by review'
              : 'Payment rejected by review',
          message: `${transaction.transactionId} · ${formatInr(
            transaction.amount
          )}`,
          tone: decision === 'APPROVED' ? 'success' : 'warning',
          transactionRef: transaction.transactionId,
        });
        return;
      }

      const approved = decision === 'APPROVED';

      addNotification({
        kind: 'review',
        title: approved ? 'Payment approved' : 'Payment declined',
        message: `${formatInr(transaction.amount)} · ${
          transaction.status === 'COMPLETED'
            ? 'Funds have been transferred.'
            : 'The transfer was not completed.'
        }`,
        tone: approved ? 'success' : 'error',
        transactionRef: transaction.transactionId,
      });

      if (approved) {
        toast.success(
          'Payment approved',
          'An admin approved your transfer and the funds have moved.'
        );
      } else {
        toast.error(
          'Payment declined',
          'An admin declined your transaction. No money was moved.'
        );
      }
    }

    function handleFraudAlert(payload) {
      const alert = payload?.alert;
      if (!alert) return;

      publish('fraud:alert', payload);

      addNotification({
        kind: 'fraud-alert',
        title: 'New fraud alert',
        message: `${
          alert.transaction?.transactionId || alert.transactionId
        } · ${alert.riskLevel} risk (${alert.riskScore}/100)`,
        tone: 'warning',
        transactionRef:
          alert.transaction?.transactionId || alert.transactionId,
      });

      toast.warning(
        'Fraud alert',
        'A risky payment was detected and needs investigation.'
      );
    }

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('transaction:created', handleCreated);
    socket.on('transaction:reviewed', handleReviewed);
    socket.on('fraud:alert', handleFraudAlert);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [user?.id, user?.role, publish, addNotification, toast]);

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      event,
      notifications,
      unreadCount,
      markAllRead,
      clearNotifications,
    }),
    [connected, event, notifications, unreadCount, markAllRead, clearNotifications]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used inside a RealtimeProvider.');
  }
  return context;
}
