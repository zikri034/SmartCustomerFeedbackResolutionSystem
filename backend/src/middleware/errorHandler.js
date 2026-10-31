'use strict';

/**
 * Global error handler middleware.
 * Must be registered as the last middleware in Express.
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'An unexpected error occurred.';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[errorHandler] ${statusCode} –`, err.stack || message);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
