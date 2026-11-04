import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../services/tokenService.js';

/**
 * Validates the Bearer token and reloads the user from MongoDB.
 * The database is the authority for roles, never the JWT claim or client body.
 */
export async function authenticate(req, _res, next) {
  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      throw ApiError.unauthorized('A Bearer token is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized('Your session is invalid or has expired.');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('The account for this session no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...allowedRoles) {
  return function authorizationMiddleware(req, _res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('Admin access is required for this resource.')
      );
    }

    return next();
  };
}
