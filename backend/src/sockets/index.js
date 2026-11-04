import { Server } from 'socket.io';
import { frontendOrigins } from '../config/env.js';
import { User } from '../models/User.js';
import { verifyToken } from '../services/tokenService.js';
import { setSocketServer } from './socketRegistry.js';

/**
 * Authenticated Socket.IO server.
 * Customers join only their own room; admins additionally join the admin room.
 * No event is broadcast to every connected socket.
 */
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendOrigins,
      credentials: true,
    },
  });

  setSocketServer(io);

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        String(socket.handshake.headers.authorization || '').replace(
          /^Bearer\s+/i,
          ''
        );

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('name role');

      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.data.user = {
        id: user._id.toString(),
        role: user.role,
        name: user.name,
      };

      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;

    socket.join(`user:${id}`);
    if (role === 'admin') {
      socket.join('admins');
    }

    socket.emit('socket:ready', { userId: id, role });
  });

  return io;
}
