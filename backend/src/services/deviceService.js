import { Device } from '../models/Device.js';

/**
 * Returns true only when the customer has used this device before.
 * A missing device id never raises a "new device" signal.
 */
export async function isNewDevice(userId, deviceId) {
  if (!deviceId) return false;

  const existing = await Device.exists({ userId, deviceId });
  return !existing;
}
