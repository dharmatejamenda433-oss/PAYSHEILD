/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * The error handler converts it into the API error envelope.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(code, message, details = null) {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(code, message, details = null) {
    return new ApiError(422, code, message, details);
  }
}
