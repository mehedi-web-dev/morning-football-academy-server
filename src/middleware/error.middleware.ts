import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
  code?: number | string;
}

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details: unknown = err.details;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  }

  // Handle MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error: A resource with that unique value already exists';
    details = undefined;
  }

  // Handle BSON/ObjectId error
  if (err.name === 'BSONError' || message.includes('ObjectId')) {
    statusCode = 400;
    message = 'Invalid ID format provided';
  }

  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${statusCode} - ${message}`);
    if (err.stack && env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
  });
}
