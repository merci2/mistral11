// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        roles: string[];
      };
    }
  }
}

// Verify Microsoft token and extract user info
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip authentication in development mode
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
      req.user = {
        id: 'dev-user-123',
        email: 'developer@example.com',
        name: 'Developer User',
        roles: ['User', 'Admin'] // Give all roles in dev mode
      };
      return next();
    }

    // Production authentication
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // For production, you should verify the Microsoft token properly
    // This is a simplified version
    // You would need to:
    // 1. Verify the token with Microsoft's public keys
    // 2. Check the issuer, audience, etc.
    // 3. Extract user information from the token
    
    // For now, we'll decode the token (in production, use proper verification)
    const decoded = jwt.decode(token) as any;
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = {
      id: decoded.oid || decoded.sub || 'unknown',
      email: decoded.email || decoded.preferred_username || 'unknown@example.com',
      name: decoded.name || 'Unknown User',
      roles: decoded.roles || []
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    
    // In development, continue anyway
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
      req.user = {
        id: 'error-fallback-user',
        email: 'fallback@example.com',
        name: 'Fallback User',
        roles: ['User']
      };
      return next();
    }
    
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Check if user has admin role
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip in development
  if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Check for admin role
  // You can customize this based on your Azure AD setup
  const isAdmin = req.user.roles.includes('Admin') || 
                   req.user.roles.includes('Administrator') ||
                   req.user.email?.includes('@admin.'); // Simple example
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};