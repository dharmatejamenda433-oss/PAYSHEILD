import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and replaces req.body / req.query / req.params with parsed values.
 * Controllers therefore only see typed, sanitized input.
 */
export function validate(schemas) {
  return function validationMiddleware(req, _res, next) {
    try {
      for (const key of ['params', 'query', 'body']) {
        if (!schemas[key]) continue;

        const result = schemas[key].safeParse(req[key]);

        if (!result.success) {
          throw new ApiError(
            400,
            'VALIDATION_ERROR',
            'Request validation failed.',
            result.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            }))
          );
        }

        req[key] = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
