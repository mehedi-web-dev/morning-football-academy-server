import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth.js';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: typeof auth.$Infer.Session.user;
  session?: typeof auth.$Infer.Session.session;
}


export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid Admin session required',
      });
      return;
    }

    // Single Admin authorization check
    const authorizedEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    const userEmail = session.user.email.toLowerCase().trim();

    if (userEmail !== authorizedEmail) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions. Authorized Admin access required',
      });
      return;
    }

    // Attach verified session and user to request
    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Session verification failed:', error);
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Failed to verify session',
    });
  }
}
