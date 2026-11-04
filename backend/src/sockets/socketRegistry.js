let socketServer = null;

export function setSocketServer(io) {
  socketServer = io;
}

export function getSocketServer() {
  return socketServer;
}

export function emitToUser(userId, eventName, payload) {
  if (!socketServer || !userId) return;
  socketServer.to(`user:${userId.toString()}`).emit(eventName, payload);
}

export function emitToAdmins(eventName, payload) {
  if (!socketServer) return;
  socketServer.to('admins').emit(eventName, payload);
}
