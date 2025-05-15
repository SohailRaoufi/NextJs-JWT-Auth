/* eslint-disable @typescript-eslint/no-unused-vars */
import { User } from '@prisma/client';
import { NextResponse } from 'next/server';
import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { HttpStatusCode } from 'axios';
import { STATUS_CODES } from 'http';
import prisma from '@/database/db';

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error('Secret Key is not defined in the environment variables');
}

export interface AuthResult {
  authenticated: boolean;
  user?: Omit<User, 'password'>;
  error?: string;
}

/**
 * Generate a JWT token for a given user.
 */
export async function generateToken(user: User): Promise<string> {
  const payload: JWTPayload = {
    sub: user.id,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(new TextEncoder().encode(SECRET_KEY));

  return token;
}

/**
 * Verify a JWT token.
 */
export async function verifyUser(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET_KEY)
    );
    return payload;
  } catch (error) {
    return null;
  }
}

// Function to get the JWT token from the request
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
}

// Authentication handler for API routes
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthResult> {
  const token = getTokenFromRequest(req);

  if (!token) {
    return { authenticated: false, error: 'No authentication token provided' };
  }

  const payload = await verifyUser(token);
  if (!payload || !payload.sub) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  // Fetch user from the database
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return { authenticated: false, error: 'User not found' };
    }

    const { password, ...safeUser } = user;

    return { authenticated: true, user: safeUser };
  } catch (error) {
    return { authenticated: false, error: 'Authentication error' };
  }
}

// Protected API handler
export async function withAuth(
  req: NextRequest,
  handler: (
    req: NextRequest,
    user: Omit<User, 'password'>
  ) => Promise<NextResponse>,
  permissions: string[] = [] // make sure to type safe the permissions - (this is a basic permission)
): Promise<NextResponse> {
  const { authenticated, user, error } = await authenticateRequest(req);

  if (!authenticated || !user) {
    return NextResponse.json(
      {
        message: error,
        status: HttpStatusCode.Unauthorized,
        error: STATUS_CODES[HttpStatusCode.Unauthorized],
      },
      { status: HttpStatusCode.Unauthorized }
    );
  }

  if (permissions.length > 0) {
    if (!permissions.includes(user.role)) {
      return NextResponse.json(
        {
          message: 'Permission Denied',
          status: HttpStatusCode.Forbidden,
          error: STATUS_CODES[HttpStatusCode.Forbidden],
        },
        { status: HttpStatusCode.Forbidden }
      );
    }
  }

  // Add user to request for use in the handler
  return handler(req, user);
}
