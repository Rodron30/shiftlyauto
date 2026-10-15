import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { isIP } from "node:net";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  error?: string;
}

const MAX_REQUESTS_PER_HOUR = 5; // Maximum 5 submissions per hour per identifier

/**
 * Checks if a request identifier (IP address) has exceeded the rate limit.
 * Uses the atomic PostgreSQL RPC function for thread-safe rate limiting.
 *
 * @param identifier - The request identifier (e.g., hashed IP address)
 * @param endpoint - The endpoint being accessed ('pre-approval' or 'sell-car')
 * @returns Object with allowed status, remaining requests, and reset time
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseAdminClient();

    // Call the atomic rate-limit function in PostgreSQL
    const { data, error } = await supabase.rpc("check_bcautoloan_rate_limit", {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: MAX_REQUESTS_PER_HOUR,
      p_window_seconds: 3600, // 1 hour
    });

    if (error) {
      console.error("Rate limit RPC error:", error);
      // If the RPC function doesn't exist (development), allow the request
      if (error.code === "42883") { // function does not exist
        console.warn("Rate limit RPC function not found - allowing request");
        return {
          allowed: true,
          remaining: MAX_REQUESTS_PER_HOUR,
          resetAt: null,
        };
      }
      // For other errors, fail closed in production
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        error: "Rate limit service unavailable",
      };
    }

    if (!data || data.length === 0) {
      console.error("Rate limit RPC returned no data");
      // Fail closed
      return {
        allowed: false,
        remaining: 0,
        resetAt: null,
        error: "Rate limit service unavailable",
      };
    }

    const result = data[0];
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.reset_at ? new Date(result.reset_at) : null,
    };
  } catch (error) {
    console.error("Rate limit check exception:", error);
    // Fail closed - do not allow request if rate limiter is unavailable
    return {
      allowed: false,
      remaining: 0,
      resetAt: null,
      error: "Rate limit service unavailable",
    };
  }
}

/**
 * Extracts and hashes the client IP address for rate limiting.
 *
 * Priority order:
 * 1. Vercel's x-vercel-forwarded-for header (production)
 * 2. x-forwarded-for header (other proxies/CDNs)
 * 3. x-real-ip header (nginx and other reverse proxies)
 * 4. Fallback to a placeholder for localhost development
 *
 * Returns null when no valid IP can be determined.
 */
export function getClientIdentifier(request: NextRequest): string | null {
  // Try Vercel's header first (production)
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded && !vercelForwarded.includes(",")) {
    const ip = vercelForwarded.trim();
    if (isIP(ip) !== 0) {
      return createHash("sha256").update(ip).digest("hex");
    }
  }

  // Try standard x-forwarded-for header (other proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP if multiple are present
    const firstIp = forwarded.split(",")[0].trim();
    if (isIP(firstIp) !== 0) {
      return createHash("sha256").update(firstIp).digest("hex");
    }
  }

  // Try x-real-ip header (nginx, etc.)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const ip = realIp.trim();
    if (isIP(ip) !== 0) {
      return createHash("sha256").update(ip).digest("hex");
    }
  }

  // For localhost development, return a placeholder identifier
  // This allows testing the flow locally while still having rate limiting in production
  const host = request.headers.get("host") || "localhost";
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    return createHash("sha256").update(`localhost-dev-${Date.now()}`).digest("hex");
  }

  // No valid IP found
  return null;
}