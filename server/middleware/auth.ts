import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { resolveJwtSecret } from "../config/authSecrets";

const TOKEN_EXPIRY = "24h";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function generateToken(userId: string, email: string, role: string = "user"): string {
  return jwt.sign({ userId, email, role }, resolveJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, resolveJwtSecret());
  } catch (error) {
    return null;
  }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  req.userId = decoded.userId;
  req.user = decoded;
  next();
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
      req.user = decoded;
    }
  }
  next();
}
