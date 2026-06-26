/** Fixed-window in-memory rate limiter (cukup untuk satu instance). */
export interface RateLimiter {
  /** true bila masih boleh, false bila kuota habis untuk window berjalan. */
  check(key: string): boolean;
}

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt < now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count += 1;
      return true;
    },
  };
}
