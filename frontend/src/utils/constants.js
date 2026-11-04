export const TOKEN_KEY = 'payshield_token';
export const DEVICE_KEY = 'payshield_device_id';
export const UNAUTHORIZED_EVENT = 'payshield:unauthorized';

export const STATUS_META = {
  COMPLETED: { label: 'Completed', tone: 'success' },
  PENDING_REVIEW: { label: 'In review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  FAILED: { label: 'Failed', tone: 'neutral' },
};

export const RISK_META = {
  LOW: { label: 'Low risk', tone: 'success' },
  MEDIUM: { label: 'Medium risk', tone: 'warning' },
  HIGH: { label: 'High risk', tone: 'danger' },
};

export const DECISION_META = {
  APPROVE: { label: 'Approved automatically', tone: 'success' },
  MANUAL_REVIEW: { label: 'Sent for manual review', tone: 'warning' },
  DECLINE: { label: 'Declined automatically', tone: 'danger' },
};

export const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'FAILED', label: 'Failed' },
];

export const RISK_OPTIONS = [
  { value: '', label: 'All risk levels' },
  { value: 'LOW', label: 'Low risk' },
  { value: 'MEDIUM', label: 'Medium risk' },
  { value: 'HIGH', label: 'High risk' },
];

export const RISK_CHART_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f43f5e',
};

export const STATUS_CHART_COLORS = {
  COMPLETED: '#10b981',
  PENDING_REVIEW: '#f59e0b',
  APPROVED: '#3b82f6',
  DECLINED: '#f43f5e',
  FAILED: '#94a3b8',
};
