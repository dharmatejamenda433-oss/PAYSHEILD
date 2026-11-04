import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a short-lived access token. The role is embedded for convenience,
 * but authorization middleware always reloads the user from MongoDB.
 */
export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
