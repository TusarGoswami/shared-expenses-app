/**
 * Central error handling middleware.
 * Catches all errors thrown in route handlers and returns a consistent JSON response.
 */
const errorHandler = (err, _req, res, _next) => {
  console.error('❌ Error:', err.message);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => e.message);
    return res.status(400).json({
      message: 'Validation error',
      errors: messages,
    });
  }

  // Sequelize duplicate key error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'field';
    return res.status(409).json({
      message: `Duplicate value for field: ${field}`,
    });
  }

  // Sequelize database/cast errors (invalid UUID formatting, etc.)
  if (err.name === 'SequelizeDatabaseError' && err.message.includes('invalid input syntax for type uuid')) {
    return res.status(400).json({
      message: 'Invalid ID format. Expected a valid UUID.',
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'File is too large. Maximum size is 5MB.',
    });
  }

  // Custom application errors with statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Default server error
  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
};

/**
 * Helper to create an error with a status code for use in route handlers.
 * Usage: throw createError(404, 'Group not found');
 */
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { errorHandler, createError };
