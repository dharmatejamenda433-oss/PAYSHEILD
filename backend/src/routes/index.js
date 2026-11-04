import { Router } from 'express';
import authRoutes from './authRoutes.js';
import transactionRoutes from './transactionRoutes.js';
import accountRoutes from './accountRoutes.js';
import adminRoutes from './adminRoutes.js';
import { health } from '../controllers/healthController.js';

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/accounts', accountRoutes);
router.use('/admin', adminRoutes);

export default router;
