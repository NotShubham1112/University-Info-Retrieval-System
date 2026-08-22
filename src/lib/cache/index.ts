import { LRUCache } from "lru-cache";
import { redisGet, redisSet, redisDel, getRedisClient } from "./redis";

// TTL table (seconds) — spec §5.1
// Never cache auth/session/PII. profile keys hold only student_summary projection (no aadhaar_number).
export const CACHE_TTL = {
  /** student profile (student_summary) */
  profile: 60,
  /** search results (search_students RPC) */
  search: 10,
  /** dashboard stats (dashboard_stats RPC) */
  stats: 30,
  /** reference lists: courses, fee_category_rates, reservation_category, etc. */
  reference: 300,
  /** alias groups kept for clarity — same value as reference */
  fee: 300,
  course: 300,
  /** generic list cache */
  list: 60,
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;

// Re-export for convenience so callers don't import two places
export { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/db";

// --- LRU hot path ---
// max 500 entries, default TTL 60_000 ms (1 minute). Per-entry TTL overrides default when calling cacheSet.
const lru = new LRUCache<string, string>({
  max: 500,
  ttl: 60_000,
});

// Internal helpers: JSON serialize / deserialize with guard
function serialize<T>(value: T): string {
  return JSON.stringify(value);
}

function deserialize<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Deterministic key builder: method:url:queryString with sorted params
// Accepts either a URL object, a string URL, or explicit parts.
export function buildCacheKey(
  method: string,
  url: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  const sorted = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const base = `${method.toUpperCase()}:${url}`;
  return sorted ? `${base}?${sorted}` : base;
}

// Alternative helper: build from NextRequest URL + sorted search string
export function buildCacheKeyFromUrl(
  method: string,
  url: URL,
): string {
  const entries = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const base = `${method.toUpperCase()}:${url.pathname}`;
  return qs ? `${base}?${qs}` : base;
}

// --- Core facade ---

export async function cacheGet<T>(key: string): Promise<T | null> {
  // 1. LRU hot path
  const lruRaw = lru.get(key);
  if (lruRaw !== undefined) {
    const parsed = deserialize<T>(lruRaw);
    if (parsed !== null) return parsed;
    // corrupted entry — evict
    lru.delete(key);
  }

  // 2. Redis
  const redisVal = await redisGet<T>(key);
  if (redisVal !== null) {
    // backfill LRU (best-effort, no TTL enforcement beyond default; per-entry TTL is handled by redis)
    try {
      lru.set(key, serialize(redisVal));
    } catch {
      // ignore LRU errors
    }
    return redisVal;
  }

  return null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  if (value === undefined) return;
  const raw = serialize(value);
  // LRU with per-entry TTL (ms). lru-cache v11 expects options object { ttl }
  try {
    lru.set(key, raw, { ttl: ttlSeconds * 1000 });
  } catch {
    // fallback for older signature (ttl as number)
    try {
      // @ts-expect-error — fallback
      lru.set(key, raw, ttlSeconds * 1000);
    } catch {
      // ignore
    }
  }
  // Redis — non-fatal if down (wrapper already swallows errors)
  try {
    await redisSet(key, value, ttlSeconds);
  } catch {
    // swallow
  }
}

export async function cacheDel(key: string): Promise<void> {
  lru.delete(key);
  try {
    await redisDel(key);
  } catch {
    // swallow
  }
}

// Delete all keys whose string key starts with prefix from LRU and Redis (bounded scan).
export async function cacheInvalidate(prefix: string): Promise<void> {
  // LRU: iterate keys()
  for (const k of lru.keys()) {
    if (k.startsWith(prefix)) lru.delete(k);
  }

  // Redis: scan or keys scan bounded
  const client = getRedisClient();
  if (!client) return;
  try {
    // Ensure connected — redisGet/redisSet would handle, but for scan we need isReady
    // Attempt a lightweight ping path via client.isReady; actual connection handled by closeRedis logic
    // Use KEYS for simplicity when dataset is bounded (spec says bounded scan, no complex registry).
    // Prefer SCAN when available for production safety.
    // node-redis v4+ supports scan with options
    if (typeof (client as unknown as { scan: unknown }).scan === "function") {
      // SCAN loop
      let cursor = 0;
      do {
        // node-redis scan signature: scan(cursor, { MATCH: pattern, COUNT: n })
        const result = await (
          client as unknown as {
            scan: (
              c: number,
              opts?: { MATCH?: string; COUNT?: number },
            ) => Promise<{ cursor: number; keys: string[] } | string[]>;
          }
        ).scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
        // Handle both return shapes: { cursor, keys } or [cursor, keys]
        let nextCursor: number;
        let keys: string[];
        if (Array.isArray(result)) {
          // Older shape may return [cursor, keys] — handle loosely
          const arr = result as unknown as [string | number, string[]];
          nextCursor = Number(arr[0]);
          keys = (arr[1] ?? []) as string[];
        } else if (
          result &&
          typeof result === "object" &&
          "cursor" in result &&
          "keys" in result
        ) {
          nextCursor = (result as { cursor: number }).cursor;
          keys = (result as { keys: string[] }).keys;
        } else {
          break;
        }
        if (keys.length > 0) {
          try {
            await client.del(keys);
          } catch {
            // swallow per-batch errors
          }
        }
        cursor = nextCursor;
      } while (cursor !== 0);
    } else if (typeof (client as unknown as { keys: unknown }).keys === "function") {
      const keys = await (
        client as unknown as { keys: (pattern: string) => Promise<string[]> }
      ).keys(`${prefix}*`);
      if (keys.length > 0) {
        await client.del(keys);
      }
    }
  } catch {
    // Redis down — non-fatal
  }
}

// Convenience: get → miss → fetch() → set → return
// Swallow cache-write errors only; fetch errors propagate as source of truth is DB.
export async function getCachedOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  try {
    await cacheSet(key, fresh, ttlSeconds);
  } catch {
    // swallow write-path errors only
  }
  return fresh;
}

// Test-only: expose LRU instance for inspection / reset
export function __getLruForTests(): LRUCache<string, string> {
  return lru;
}

export function __clearLruForTests(): void {
  lru.clear();
}
