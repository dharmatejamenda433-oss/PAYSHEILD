import axios from 'axios';
import { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../utils/constants';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register');

    // An expired or revoked token should log the user out. Login failures are
    // expected 401s and must not trigger that side effect.
    if (status === 401 && !isAuthEndpoint && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  }
);

/** Every successful API response wraps its payload in `{ success, data }`. */
export function apiData(response) {
  return response?.data?.data;
}

/**
 * Converts an Axios error into a predictable shape for forms and toasts.
 * The backend always returns `{ success: false, error: { code, message } }`.
 */
export function getApiError(error) {
  if (error?.code === 'ECONNABORTED') {
    return {
      code: 'TIMEOUT',
      message: 'The server took too long to respond. Please try again.',
      details: [],
    };
  }

  if (!error?.response) {
    return {
      code: 'NETWORK_ERROR',
      message:
        'Could not reach the PayShield API. Check that the backend is running.',
      details: [],
    };
  }

  const payload = error.response.data;
  const details = payload?.error?.details;

  return {
    code: payload?.error?.code || 'REQUEST_FAILED',
    message:
      payload?.error?.message ||
      `The request failed with status ${error.response.status}.`,
    details: Array.isArray(details) ? details : [],
  };
}

export default api;
