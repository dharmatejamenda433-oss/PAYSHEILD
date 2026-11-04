export function sendSuccess(res, data, statusCode = 200, meta = null) {
  const body = { success: true, data };

  if (meta) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
}

export function sendError(res, statusCode, code, message, details = null) {
  const body = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    body.error.details = details;
  }

  return res.status(statusCode).json(body);
}
