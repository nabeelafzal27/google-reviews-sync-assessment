import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Express middleware that establishes a correlation ID for each request.
 *
 * If the caller supplies an X-Request-ID header (common in service meshes),
 * that value is reused. Otherwise a random UUID is generated. The ID is
 * attached to the request object and echoed back in the response header
 * so downstream consumers can correlate logs to a specific request.
 */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as RequestWithContext).requestId = requestId;
  next();
}

/**
 * Extended request type carrying the correlation ID.
 * Controllers and middleware can use this to thread the ID into logs.
 */
export interface RequestWithContext extends Request {
  requestId: string;
}
