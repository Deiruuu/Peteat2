// Centralized Express error-handling middleware for consistent JSON responses
module.exports = function errorHandler(err, req, res, next) {
  // Log full error on the server for diagnostics
  console.error(err.stack || err);

  // If response status code hasn't been set, default to 500
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    // Only expose stack trace in development to avoid leaking internals
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}; 