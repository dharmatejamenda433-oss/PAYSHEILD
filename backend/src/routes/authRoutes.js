import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/authSchemas.js';
import * as authController from '../controllers/authController.js';

const router = Router();

const authLimiter = rateLimit({
  scope: 'auth',
  windowSeconds: 15 * 60,
  max: 50,
  keyResolver: (req) => req.ip,
});

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.loginUser);
router.get('/profile', authenticate, authController.profile);

export default router;
