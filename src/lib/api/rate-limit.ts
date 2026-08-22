// Sliding window rate limiter per IP — in-process Map<ip, number[] timestamps>
// Default 300/min general, 30/min for auth routes (spec §5.3).

export type RouteGroup = "general" | "auth";

const DEFAULT_GENERAL_LIMIT = 300;
const DEFAULT_AUTH_LIMIT = 30;
const WINDOW_MS = 60_000;

// Allow env override for tests / deployment
function getLimit(routeGroup: RouteGroup): number {
  const envVal = Number(process.env.RATE_LIMIT_PER_MINUTE);
  // If env override is set and routeGroup is general, use it; auth keeps 30 unless overridden by specific env?
  // Spec: RATE_LIMIT_PER_MINUTE default 300 general, 30 on auth.
  // If RATE_LIMIT_PER_MINUTE is set, it overrides general; auth stays at 30 unless RATE_LIMIT_AUTH_PER_MINUTE set.
  if (routeGroup === "auth") {
    const authEnv = Number(process.env.RATE_LIMIT_AUTH_PER_MINUTE);
    if (!Number.isNaN(authEnv) && authEnv > 0) return authEnv;
    return DEFAULT_AUTH_LIMIT;
  }
  if (!Number.isNaN(envVal) && envVal > 0) return envVal;
  return DEFAULT_GENERAL_LIMIT;
}

// Global store — exported for test reset
export const _store: Map<string, number[]> = new Map();

export function _resetForTests(): void {
  _store.clear();
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
  limit: number;
}

export function checkRateLimit(
  ip: string,
  routeGroup: RouteGroup = "general",
): RateLimitResult {
  const now = Date.now();
  const limit = getLimit(routeGroup);
  const key = `${routeGroup}:${ip}`;

  let timestamps = _store.get(key);
  if (!timestamps) {
    timestamps = [];
    _store.set(key, timestamps);
  }

  // Prune outside window
  const windowStart = now - WINDOW_MS;
  // Remove stale entries from front (timestamps are append-only, so linear scan from start)
  let pruneIdx = 0;
  while (pruneIdx < timestamps.length && timestamps[pruneIdx] <= windowStart) {
    pruneIdx++;
  }
  if (pruneIdx > 0) timestamps.splice(0, pruneIdx);

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { ok: false, retryAfterSec, remaining: 0, limit };
  }

  timestamps.push(now);
  return {
    ok: true,
    retryAfterSec: 0,
    remaining: limit - timestamps.length,
    limit,
  };
}

// Variant that accepts explicit limit for tests
export function checkRateLimitWithLimit(
  ip: string,
  limit: number,
  windowMs: number = WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const key = `custom:${ip}:${limit}:${windowMs}`;
  let timestamps = _store.get(key);
  if (!timestamps) {
    timestamps = [];
    _store.set(key, timestamps);
  }
  const windowStart = now - windowMs;
  let pruneIdx = 0;
  while (pruneIdx < timestamps.length && timestamps[pruneIdx] <= windowStart) {
    pruneIdx++;
  }
  if (pruneIdx > 0) timestamps.splice(0, pruneIdx);

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { ok: false, retryAfterSec, remaining: 0, limit };
  }
  timestamps.push(now);
  return { ok: true, retryAfterSec: 0, remaining: limit - timestamps.length, limit };
}
