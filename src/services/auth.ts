/**
 * AppleFlow POS - Authentication Service
 * Enterprise-grade authentication with bcrypt and JWT
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const PIN_SALT_ROUNDS = 12;

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthService {
  /**
   * Hash a PIN using bcrypt
   */
  async hashPIN(pin: string): Promise<string> {
    return bcrypt.hash(pin, PIN_SALT_ROUNDS);
  }

  /**
   * Verify a PIN against a hash
   */
  async verifyPIN(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { userId: payload.userId },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Decode to get expiration time
    const decoded = jwt.decode(accessToken) as { exp: number };

    return {
      accessToken,
      refreshToken,
      expiresIn: decoded.exp,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  }

  /**
   * Create a new session in the database
   */
  async createSession(
    userId: string,
    token: string,
    refreshToken: string
  ): Promise<void> {
    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    await prisma.session.create({
      data: {
        userId,
        token,
        refreshToken,
        expiresAt,
      },
    });
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    try {
      // Verify refresh token
      const { userId } = this.verifyRefreshToken(refreshToken);

      // Check if session exists
      const session = await prisma.session.findFirst({
        where: { refreshToken },
      });

      if (!session) {
        return null;
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return null;
      }

      // Generate new tokens
      const tokens = this.generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Update session
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 8);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        },
      });

      return tokens;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Check if user has required role
   */
  hasRole(userRole: string, requiredRole: string): boolean {
    const roles = ['CASHIER', 'SUPERVISOR', 'MANAGER', 'ADMIN'];
    const userIndex = roles.indexOf(userRole);
    const requiredIndex = roles.indexOf(requiredRole);

    return userIndex >= requiredIndex;
  }
}

// Export singleton instance
export const authService = new AuthService();
