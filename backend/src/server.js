import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
} from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { createSocketServer } from './sockets/index.js';

async function startServer() {
  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`[api] PayShield backend listening on http://localhost:${env.PORT}`);
    console.log(`[api] environment: ${env.NODE_ENV}`);
  });

  async function shutdown(signal) {
    console.log(`\n[api] ${signal} received. Closing connections...`);

    io.close();
    httpServer.close(async () => {
      try {
        await disconnectRedis();
        await disconnectDatabase();
      } finally {
        process.exit(0);
      }
    });

    // Do not hang forever if a socket refuses to close.
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('[api] Failed to start:', error);
  process.exit(1);
});
