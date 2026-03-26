import { Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/error-handler';
import { AppError, NotFoundError, ValidationError } from '../../src/types';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockRequest(requestId?: string): Request {
  const req: Partial<Request> = {};
  if (requestId) {
    (req as Record<string, unknown>).requestId = requestId;
  }
  return req as Request;
}

describe('errorHandler', () => {
  it('should return 404 for NotFoundError', () => {
    const err = new NotFoundError('SyncRecord', 'fb_123');
    const req = mockRequest('req-1');
    const res = mockResponse();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('not found'),
      }),
    );
  });

  it('should return 400 for ValidationError', () => {
    const err = new ValidationError('Invalid input', { field: 'rating' });
    const req = mockRequest('req-2');
    const res = mockResponse();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid input',
        details: { field: 'rating' },
      }),
    );
  });

  it('should return 500 for generic Error and mask the message', () => {
    const err = new Error('Sensitive internal details');
    const req = mockRequest('req-3');
    const res = mockResponse();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
      }),
    );
  });

  it('should include requestId in response when present', () => {
    const err = new NotFoundError('SyncRecord', 'fb_123');
    const req = mockRequest('req-4');
    const res = mockResponse();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-4',
      }),
    );
  });

  it('should handle AppError with custom status code', () => {
    const err = new AppError(502, 'Bad Gateway', { provider: 'google' });
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Bad Gateway',
        details: { provider: 'google' },
      }),
    );
  });
});
