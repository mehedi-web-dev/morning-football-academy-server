import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorDetails = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: errorDetails,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errorDetails = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        details: errorDetails,
      });
      return;
    }
    // Express 5 defines req.query as a getter. Clear and assign parsed fields.
    const queryObj = req.query as Record<string, unknown>;
    for (const key of Object.keys(queryObj)) {
      delete queryObj[key];
    }
    Object.assign(queryObj, result.data);
    next();
  };
}

export function validateParams(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errorDetails = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        message: 'Invalid URL parameters',
        details: errorDetails,
      });
      return;
    }
    const paramsObj = req.params as Record<string, unknown>;
    for (const key of Object.keys(paramsObj)) {
      delete paramsObj[key];
    }
    Object.assign(paramsObj, result.data);
    next();
  };
}

function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
