import type { NextFunction, Request, Response } from 'express';

/**
 * Blocks the upload routes for anyone without an authenticated AdminJS session.
 * `@adminjs/express` stores the logged-in user at `req.session.adminUser`; this
 * guard also accepts a custom predicate for other setups.
 */
export const adminSessionGuard =
  (isAuthenticated?: (req: Request) => boolean) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as Request & { session?: Record<string, unknown> }).session;
    const ok = isAuthenticated
      ? isAuthenticated(req)
      : !!session && (!!session.adminUser || !!session.adminjs);
    if (ok) {
      next();
      return;
    }
    res.status(401).json({ message: 'Authentication required.' });
  };
