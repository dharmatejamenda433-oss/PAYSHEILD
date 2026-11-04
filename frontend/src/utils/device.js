import { DEVICE_KEY } from './constants';

/**
 * A random identifier stored in this browser. The backend uses it to decide
 * whether a payment comes from a device it has seen before.
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_KEY);

  if (!deviceId) {
    deviceId =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
  }

  return deviceId;
}

export function getClientLocation() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}
