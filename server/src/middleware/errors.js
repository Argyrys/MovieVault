export function notFound(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const payload = {
    error: err.code || 'INTERNAL_ERROR',
    message: status === 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message,
  };
  if (status === 500) console.error('[error]', err);
  res.status(status).json(payload);
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
