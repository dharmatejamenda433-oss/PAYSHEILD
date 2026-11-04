import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimiter.js';
import {
  transferSchema,
  transactionListQuerySchema,
  transactionIdParamSchema,
} from '../validators/transactionSchemas.js';
import * as transactionController from '../controllers/transactionController.js';

const router = Router();

router.use(authenticate);

const transferLimiter = rateLimit({
  scope: 'transfer',
  windowSeconds: 10 * 60,
  max: 30,
  keyResolver: (req) => req.user._id.toString(),
});

router.post(
  '/',
  transferLimiter,
  validate({ body: transferSchema }),
  transactionController.create
);

router.get(
  '/',
  validate({ query: transactionListQuerySchema }),
  transactionController.listMine
);

router.get(
  '/:id/risk',
  validate({ params: transactionIdParamSchema }),
  transactionController.risk
);

router.get(
  '/:id',
  validate({ params: transactionIdParamSchema }),
  transactionController.detail
);

export default router;
