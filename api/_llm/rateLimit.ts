export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 20, windowMs = 60 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string, nowMs: number = Date.now()): RateLimitResult {
    const cutoff = nowMs - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? nowMs;
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        resetAtMs: oldest + this.windowMs,
      };
    }

    recent.push(nowMs);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      resetAtMs: (recent[0] ?? nowMs) + this.windowMs,
    };
  }

  reset() {
    this.hits.clear();
  }
}
