import { io } from 'socket.io-client';

/**
 * Opens an authenticated Socket.IO connection.
 * When VITE_SOCKET_URL is empty the client connects to the same origin,
 * which works with the Vite dev proxy and the nginx production proxy.
 */
export function createSocket(token) {
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

  return io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 8,
    reconnectionDelay: 1500,
    timeout: 10000,
  });
}
