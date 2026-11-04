import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { isDatabaseConnected } from '../config/database.js';
import { isRedisAvailable } from '../config/redis.js';

export const health = asyncHandler(async (_req, res) => {
  const database = isDatabaseConnected() ? 'connected' : 'disconnected';
  const redis = isRedisAvailable() ? 'connected' : 'degraded';
  const status = database === 'connected' ? 'ok' : 'degraded';

  return sendSuccess(
    res,
    {
      status,
      database,
      redis,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    status === 'ok' ? 200 : 503
  );
});
