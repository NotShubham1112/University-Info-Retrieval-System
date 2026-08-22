import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock the redis wrapper so no real connection is needed
const redisMocks = vi.hoisted(() => ({
  redisGet: vi.fn(async () => null as unknown),
  redisSet: vi.fn(async () => true),
  redisDel: vi.fn(async () => true),
  getRedisClient: vi.fn(() => null as unknown),
}));

vi.mock("@/lib/cache/redis", () => redisMocks);
vi.mock("@/lib/cache/redis.ts", () => redisMocks);

describe("cache layered facade (LRU + Redis)", () => {
  beforeEach(async () => {
    vi.resetModules();
    // reset mocks state but keep mocked module
    redisMocks.redisGet.mockReset().mockResolvedValue(null);
    redisMocks.redisSet.mockReset().mockResolvedValue(true);
    redisMocks.redisDel.mockReset().mockResolvedValue(true);
    redisMocks.getRedisClient.mockReset().mockReturnValue(null);
    // Clear LRU between tests via helper after import
    const { __clearLruForTests } = await import("@/lib/cache/index");
    __clearLruForTests();
  });

  afterEach(async () => {
    const { __clearLruForTests } = await import("@/lib/cache/index");
    __clearLruForTests();
  });

  it("cacheSet + cacheGet round-trips via LRU (hit without touching Redis)", async () => {
    const { cacheSet, cacheGet } = await import("@/lib/cache/index");
    const value = { name: "Aisha", scores: [91, 88] };
    await cacheSet("profile:1", value, 60);
    expect(redisMocks.redisSet).toHaveBeenCalledWith("profile:1", value, 60);
    redisMocks.redisGet.mockClear();
    await expect(cacheGet<typeof value>("profile:1")).resolves.toEqual(value);
    // LRU hit → redisGet should not be called
    expect(redisMocks.redisGet).not.toHaveBeenCalled();
  });

  it("cacheGet falls back to Redis on LRU miss and backfills LRU", async () => {
    const { cacheGet } = await import("@/lib/cache/index");
    const value = { id: 1, name: "Ram" };
    redisMocks.redisGet.mockResolvedValue(value);
    await expect(cacheGet("search:q=ram")).resolves.toEqual(value);
    expect(redisMocks.redisGet).toHaveBeenCalledWith("search:q=ram");
    // Second get should be LRU hit (no second redis call)
    redisMocks.redisGet.mockClear();
    await expect(cacheGet("search:q=ram")).resolves.toEqual(value);
    expect(redisMocks.redisGet).not.toHaveBeenCalled();
  });

  it("cacheGet returns null on total miss (LRU + Redis)", async () => {
    const { cacheGet } = await import("@/lib/cache/index");
    redisMocks.redisGet.mockResolvedValue(null);
    await expect(cacheGet("missing:key")).resolves.toBeNull();
  });

  it("cacheDel deletes from both layers", async () => {
    const { cacheSet, cacheGet, cacheDel } = await import("@/lib/cache/index");
    await cacheSet("profile:2", { a: 1 }, 60);
    await expect(cacheGet("profile:2")).resolves.toEqual({ a: 1 });
    await cacheDel("profile:2");
    expect(redisMocks.redisDel).toHaveBeenCalledWith("profile:2");
    redisMocks.redisGet.mockResolvedValue(null);
    await expect(cacheGet("profile:2")).resolves.toBeNull();
  });

  it("cacheInvalidate deletes all keys with prefix from LRU", async () => {
    const { cacheSet, cacheGet, cacheInvalidate, __getLruForTests } = await import("@/lib/cache/index");
    await cacheSet("profile:1", { a: 1 }, 60);
    await cacheSet("profile:2", { a: 2 }, 60);
    await cacheSet("search:q=test", { b: 1 }, 10);
    expect(__getLruForTests().size).toBe(3);
    await cacheInvalidate("profile:");
    // profile keys gone, search remains in LRU
    redisMocks.redisGet.mockResolvedValue(null);
    await expect(cacheGet("profile:1")).resolves.toBeNull();
    await expect(cacheGet("profile:2")).resolves.toBeNull();
    await expect(cacheGet("search:q=test")).resolves.toEqual({ b: 1 });
  });

  it("cacheInvalidate scans and deletes matching Redis keys when client available", async () => {
    const fakeDel = vi.fn(async () => 1);
    const fakeScan = vi.fn(async (cursor: number) => ({
      cursor: 0,
      keys: cursor === 0 ? ["profile:10", "profile:11"] : [],
    }));
    const fakeClient = {
      isReady: true,
      scan: fakeScan,
      del: fakeDel,
      keys: vi.fn(async () => [] as string[]),
    } as unknown as ReturnType<typeof redisMocks.getRedisClient>;
    redisMocks.getRedisClient.mockReturnValue(fakeClient as unknown as null);

    const { cacheInvalidate } = await import("@/lib/cache/index");
    await cacheInvalidate("profile:");
    expect(fakeScan).toHaveBeenCalledWith(0, { MATCH: "profile:*", COUNT: 100 });
    expect(fakeDel).toHaveBeenCalledWith(["profile:10", "profile:11"]);
  });

  it("getCachedOrSet fetches on miss, caches, and returns cached on hit", async () => {
    const { getCachedOrSet } = await import("@/lib/cache/index");
    const fetchFn = vi.fn(async () => ({ data: [1, 2, 3] }));
    redisMocks.redisGet.mockResolvedValue(null);

    const first = await getCachedOrSet("list:students:page1", 60, fetchFn);
    expect(first).toEqual({ data: [1, 2, 3] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(redisMocks.redisSet).toHaveBeenCalledWith("list:students:page1", { data: [1, 2, 3] }, 60);

    // Second call should hit cache (fetch not called again)
    const second = await getCachedOrSet("list:students:page1", 60, fetchFn);
    expect(second).toEqual({ data: [1, 2, 3] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("Redis-down degraded mode: LRU-only still works (non-fatal)", async () => {
    // Simulate Redis unavailable: get returns null, set returns false, client is null
    redisMocks.redisGet.mockResolvedValue(null);
    redisMocks.redisSet.mockResolvedValue(false);
    redisMocks.getRedisClient.mockReturnValue(null);

    const { cacheSet, cacheGet, cacheInvalidate } = await import("@/lib/cache/index");
    await cacheSet("stats:overview", { total: 100 }, 30);
    await expect(cacheGet("stats:overview")).resolves.toEqual({ total: 100 });
    // Invalidate should not throw when Redis client is null
    await expect(cacheInvalidate("stats:")).resolves.toBeUndefined();
  });

  it("buildCacheKey produces stable sorted query string", async () => {
    const { buildCacheKey } = await import("@/lib/cache/index");
    const a = buildCacheKey("GET", "/api/search", { q: "ram", limit: 20, cursor: "10" });
    const b = buildCacheKey("GET", "/api/search", { cursor: "10", limit: 20, q: "ram" });
    expect(a).toBe(b);
    expect(a).toBe("GET:/api/search?cursor=10&limit=20&q=ram");
  });

  it("CACHE_TTL constants match spec (profile 60s, search 10s, reference 300s, stats 30s)", async () => {
    const { CACHE_TTL } = await import("@/lib/cache/index");
    expect(CACHE_TTL.profile).toBe(60);
    expect(CACHE_TTL.search).toBe(10);
    expect(CACHE_TTL.stats).toBe(30);
    expect(CACHE_TTL.reference).toBe(300);
    expect(CACHE_TTL.fee).toBe(300);
    expect(CACHE_TTL.course).toBe(300);
  });
});
