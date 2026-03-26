import { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../../src/middleware/request-validator';

function mockReqResNext(body: unknown): { req: Request; res: Response; next: NextFunction } {
  const req = { body } as Request;
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  const next = jest.fn();
  return { req, res: res as Response, next };
}

describe('validateRequest middleware', () => {
  const schema = {
    type: 'object' as const,
    required: ['name'],
    properties: {
      name: { type: 'string' as const, minLength: 1 },
      count: { type: 'number' as const, minimum: 0 },
    },
  };

  const middleware = validateRequest(schema);

  it('should call next() for valid body', () => {
    const { req, res, next } = mockReqResNext({ name: 'test' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for missing required field', () => {
    const { req, res, next } = mockReqResNext({});
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ message: expect.any(String) }),
        ]),
      }),
    );
  });

  it('should return 400 for empty string when minLength is 1', () => {
    const { req, res, next } = mockReqResNext({ name: '' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 for wrong type', () => {
    const { req, res, next } = mockReqResNext({ name: 123 });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 for number below minimum', () => {
    const { req, res, next } = mockReqResNext({ name: 'test', count: -1 });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
