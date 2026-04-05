// Simple in-memory rate limiter
// For production, replace with Redis-backed solution

const attempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = process.env.NODE_ENV === "production" ? 5 : 100;
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}
