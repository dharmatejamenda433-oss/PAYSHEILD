import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { ledgerQuerySchema } from '../validators/transactionSchemas.js';
import * as accountController from '../controllers/accountController.js';

const router = Router();

router.use(authenticate);

router.get('/me', accountController.me);
router.get('/me/ledger', validate({ query: ledgerQuerySchema }), accountController.ledger);

export default router;
