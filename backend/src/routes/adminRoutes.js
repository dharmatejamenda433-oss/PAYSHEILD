import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimiter.js';
import {
  transactionListQuerySchema,
  transactionIdParamSchema,
  reviewActionSchema,
  fraudAlertQuerySchema,
} from '../validators/transactionSchemas.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.use(authenticate, authorize('admin'));

const reviewLimiter = rateLimit({
  scope: 'admin-review',
  windowSeconds: 60,
  max: 60,
  keyResolver: (req) => req.user._id.toString(),
});

router.get('/dashboard', adminController.dashboard);

router.get(
  '/transactions',
  validate({ query: transactionListQuerySchema }),
  adminController.transactions
);

router.get(
  '/fraud-alerts',
  validate({ query: fraudAlertQuerySchema }),
  adminController.fraudAlerts
);

router.get('/analytics', adminController.analytics);

router.post(
  '/reviews/:id/approve',
  reviewLimiter,
  validate({ params: transactionIdParamSchema, body: reviewActionSchema }),
  adminController.approve
);

router.post(
  '/reviews/:id/reject',
  reviewLimiter,
  validate({ params: transactionIdParamSchema, body: reviewActionSchema }),
  adminController.reject
);

export default router;
