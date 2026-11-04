const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

/**
 * Money is stored as integer paise everywhere in the API. The UI divides by
 * 100 only for display; it never sends floating point amounts back.
 */
export function formatInr(paise) {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) {
    return '—';
  }
  return inrFormatter.format(Number(paise) / 100);
}

export function formatInrCompact(paise) {
  if (paise === null || paise === undefined) return '—';
  return inrCompactFormatter.format(Number(paise) / 100);
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function relativeTime(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const steps = [
    { limit: 60, unit: 'second', size: 1 },
    { limit: 3600, unit: 'minute', size: 60 },
    { limit: 86400, unit: 'hour', size: 3600 },
    { limit: 604800, unit: 'day', size: 86400 },
    { limit: 2629800, unit: 'week', size: 604800 },
    { limit: 31557600, unit: 'month', size: 2629800 },
  ];

  for (const step of steps) {
    if (Math.abs(seconds) < step.limit) {
      return formatter.format(Math.round(seconds / step.size), step.unit);
    }
  }

  return formatter.format(Math.round(seconds / 31557600), 'year');
}

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise) {
  return Number(paise || 0) / 100;
}

export function formatAmountInput(rupees) {
  return Number(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getInitials(name) {
  if (!name) return 'PS';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function truncateMiddle(value, max = 18) {
  if (!value) return '—';
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

export function formatDateForInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function chartDateLabel(isoDate) {
  if (!isoDate) return '';
  const [, month, day] = isoDate.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${Number(day)} ${months[Number(month) - 1] || ''}`;
}
