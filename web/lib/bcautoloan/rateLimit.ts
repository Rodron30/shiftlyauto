import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

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
  const supabase = createSupabaseAdminClient();

  try {
    // Call the atomic rate-limit function in PostgreSQL
    const { data, error } = await supabase.rpc("check_bcautoloan_rate_limit", {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_max_requests: MAX_REQUESTS_PER_HOUR,
      p_window_seconds: 3600, // 1 hour
    });

    if (error) {
      console.error("Rate limit RPC error:", error);
      // Fail closed - do not allow request if rate limiter is unavailable
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
 * Extracts a client identifier from the request.
 * Uses IP address from X-Forwarded-For header if available, otherwise from remote address.
 * Hashes the IP using SHA-256 to avoid storing raw IP addresses.
 */
export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "unknown";

  // Hash the IP using SHA-256 to avoid storing raw IP addresses
  const hash = createHash("sha256").update(ip).digest("hex");
  return hash;
}
