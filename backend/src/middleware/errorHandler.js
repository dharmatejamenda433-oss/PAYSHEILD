import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/apiResponse.js';

export function notFoundHandler(req, res) {
  return sendError(
    res,
    404,
    'ROUTE_NOT_FOUND',
    `No API route matches ${req.method} ${req.originalUrl}.`
  );
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ApiError) {
    return sendError(
      res,
      error.statusCode,
      error.code,
      error.message,
      error.details
    );
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors || {}).map((fieldError) => ({
      field: fieldError.path,
      message: fieldError.message,
    }));
    return sendError(res, 400, 'MONGOOSE_VALIDATION_ERROR', 'Invalid data provided.', details);
  }

  if (error.name === 'CastError') {
    return sendError(res, 400, 'INVALID_IDENTIFIER', 'One of the identifiers is invalid.');
  }

  if (error.code === 11000) {
    return sendError(
      res,
      409,
      'DUPLICATE_RESOURCE',
      'A duplicate record already exists for this request.'
    );
  }

  if (error.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  console.error('[error]', error);

  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    isProduction ? 'Something went wrong. Please try again later.' : error.message
  );
}
