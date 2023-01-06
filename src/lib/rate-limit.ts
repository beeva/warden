import "server-only";

/**
 * Fixed-window rate limiter, in-process. Caps damage from a single client
 * hammering an endpoint (including the CLI's scan-upload path, which is
 * authenticated but still shouldn't be poundable unbounded) - not meant
 * to survive a multi-instance deployment.
 */
const windows = new Map<string, { count: number; windowStart: number }>();

const MAX_TRACKED_KEYS = 50_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      pruneExpired(now, windowMs);
    }
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

function pruneExpired(now: number, windowMs: number) {
  for (const [key, entry] of windows) {
    if (now - entry.windowStart >= windowMs) windows.delete(key);
  }
}

/**
 * X-Forwarded-For is "client, proxy1, proxy2, ..." - each hop appends the
 * IP it saw to the *end*. The leftmost entry is whatever the original
 * client sent, which a direct attacker fully controls. The rightmost
 * entry is the one *your* trusted proxy observed and appended, which the
 * client can't forge - taking the last hop is the standard mitigation.
 * This assumes the app sits behind exactly one trusted reverse proxy.
 */
export function clientIpFrom(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim());
    const lastHop = hops[hops.length - 1];
    if (lastHop) return lastHop;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
