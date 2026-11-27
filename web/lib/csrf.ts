import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CSRF_SECRET = process.env.CSRF_SECRET || "default-secret-change-in-production";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const signature = Buffer.from(`${timestamp}:${random}:${CSRF_SECRET}`).toString("base64");
  return signature;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(token: string): boolean {
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");

    if (parts.length !== 3) return false;

    const [timestamp, random, secret] = parts;

    // Check if token is older than 1 hour
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 3600000) return false; // 1 hour expiration

    // Verify secret matches
    return secret === CSRF_SECRET;
  } catch {
    return false;
  }
}

/**
 * Set CSRF token in cookie
 */
export async function setCSRFCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 3600, // 1 hour
    path: "/",
  });
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Get CSRF token from request header
 */
export function getCSRFHeader(request: Request): string | undefined {
  return request.headers.get(CSRF_HEADER_NAME) || undefined;
}

/**
 * Verify CSRF protection for state-changing operations
 * Returns NextResponse with 403 if validation fails, or null if valid
 */
export async function verifyCSRFProtection(request: Request): Promise<NextResponse | null> {
  const headerToken = getCSRFHeader(request);
  const cookieToken = await getCSRFCookie();

  if (!headerToken || !cookieToken) {
    return NextResponse.json(
      { error: "CSRF token missing" },
      { status: 403 }
    );
  }

  if (!validateCSRFToken(headerToken) || !validateCSRFToken(cookieToken)) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  return null; // Valid
}

/**
 * CSRF protection middleware wrapper
 * Use this to wrap state-changing API route handlers
 */
export function withCSRFProtection<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: Request, ...args: any[]) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    const method = request.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return handler(request, ...args);
    }

    // Verify CSRF for state-changing methods
    const csrfError = await verifyCSRFProtection(request);
    if (csrfError) {
      return csrfError;
    }

    return handler(request, ...args);
  }) as T;
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
