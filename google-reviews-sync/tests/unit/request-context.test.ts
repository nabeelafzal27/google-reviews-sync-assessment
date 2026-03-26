import { Request, Response, NextFunction } from 'express';
import { requestContext, RequestWithContext } from '../../src/middleware/request-context';

describe('requestContext middleware', () => {
  it('should generate a requestId when none is provided', () => {
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = jest.fn();

    requestContext(req, res, next);

    expect((req as RequestWithContext).requestId).toBeDefined();
    expect((req as RequestWithContext).requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse X-Request-ID header when provided', () => {
    const req = { headers: { 'x-request-id': 'custom-id-123' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    requestContext(req, res, next);

    expect((req as RequestWithContext).requestId).toBe('custom-id-123');
    expect(next).toHaveBeenCalled();
  });
});
