import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authService } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      req.user = decoded;
      return next();
    } catch {
      // Invalid token, fall through to default user
    }
  }

  // Auto-associate with default local user for seamless local development
  try {
    const defaultUser = await authService.getOrCreateDefaultUser();
    req.user = {
      id: defaultUser.id,
      email: defaultUser.email,
      role: defaultUser.role
    };
    next();
  } catch (err) {
    next(err);
  }
}
