// lib/rateLimit.ts
//
// Minimum-viable rate limiting (Blueprint Â§44 lists it as a security
// requirement). This is an in-memory sliding window â€” it only limits
// requests hitting the SAME warm serverless instance, so on a
// multi-instance deployment (Vercel with concurrent invocations, etc.)
// the effective limit is looser than the configured number. That's an
// acceptable V1 trade-off to avoid adding an external dependency, but
// before real production traffic, swap this for Upstash Redis or Vercel
// KV (both have small `@upstash/ratelimit`-style drop-in replacements â€”
// same `checkRateLimit(key, limit, windowMs)` signature would work).

const buckets = new Map<string, number[]>();

// Prevent unbounded memory growth in a long-lived warm instance.
const MAX_TRACKED_KEYS = 5000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);

  if (buckets.size >= MAX_TRACKED_KEYS && !buckets.has(key)) {
    // Simple eviction: drop the oldest-inserted key. Not LRU-perfect,
    // but keeps memory bounded without extra bookkeeping.
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  buckets.set(key, recent);
  return { allowed: true, remaining: limit - recent.length };
}

export function getRateLimitKey(request: Request, userId?: string | null) {
  if (userId) return `user:${userId}`;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}


