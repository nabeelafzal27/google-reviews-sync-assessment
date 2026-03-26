import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import { logger } from '../logger';
import { RequestWithContext } from './request-context';

/**
 * Global error handling middleware.
 *
 * Converts thrown errors into structured JSON responses. Domain errors
 * (AppError subclasses) carry their own status code; unexpected errors
 * are masked with a generic 500 to avoid leaking internals.
 *
 * Must be registered last in the middleware chain.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as RequestWithContext).requestId;
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      requestId,
      error: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    error: message,
    ...(requestId && { requestId }),
    ...(err instanceof AppError && err.context && { details: err.context }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
