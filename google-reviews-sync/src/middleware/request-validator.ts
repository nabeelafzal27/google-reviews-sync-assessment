import { Request, Response, NextFunction } from 'express';
import Ajv, { Schema } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, coerceTypes: false });
addFormats(ajv);

/**
 * Express middleware factory that validates request body against a JSON schema.
 * Returns 400 with structured field-level details on validation failure.
 */
export function validateRequest(schema: Schema) {
  const validate = ajv.compile(schema);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (validate(req.body)) {
      return next();
    }

    const errors = validate.errors?.map((err) => ({
      field: err.instancePath || err.params?.missingProperty || 'unknown',
      message: err.message || 'Validation error',
    }));

    res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  };
}
