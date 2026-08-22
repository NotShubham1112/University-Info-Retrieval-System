import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, _store, _resetForTests } from "@/lib/api/rate-limit";

describe("rate limiter (sliding window per IP)", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetForTests();
  });

  it("allows requests under the limit", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(ip, "general");
      expect(r.ok).toBe(true);
    }
  });

  it("rejects burst over limit and returns retryAfterSec", () => {
    const ip = "5.6.7.8";
    // Use auth group which has limit 30; send 30 allowed
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(ip, "auth").ok).toBe(true);
    }
    const rejected = checkRateLimit(ip, "auth");
    expect(rejected.ok).toBe(false);
    expect(rejected.retryAfterSec).toBeGreaterThan(0);
    expect(rejected.retryAfterSec).toBeLessThanOrEqual(60);
    expect(rejected.remaining).toBe(0);
  });

  it("window resets after 60s", () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 30; i++) checkRateLimit(ip, "auth");
    expect(checkRateLimit(ip, "auth").ok).toBe(false);
    // Advance past window
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(ip, "auth").ok).toBe(true);
  });

  it("isolates per-IP (one IP hitting limit does not affect another)", () => {
    const ipA = "10.0.0.1";
    const ipB = "10.0.0.2";
    for (let i = 0; i < 30; i++) checkRateLimit(ipA, "auth");
    expect(checkRateLimit(ipA, "auth").ok).toBe(false);
    expect(checkRateLimit(ipB, "auth").ok).toBe(true);
  });

  it("isolates per route group (general vs auth)", () => {
    const ip = "11.11.11.11";
    for (let i = 0; i < 30; i++) checkRateLimit(ip, "auth");
    expect(checkRateLimit(ip, "auth").ok).toBe(false);
    // general group should still be ok (different key)
    expect(checkRateLimit(ip, "general").ok).toBe(true);
  });

  it("respects RATE_LIMIT_PER_MINUTE env override for general", async () => {
    vi.resetModules();
    process.env.RATE_LIMIT_PER_MINUTE = "5";
    const { checkRateLimit: freshCheck, _resetForTests: freshReset } = await import(
      "@/lib/api/rate-limit"
    );
    freshReset();
    const ip = "22.22.22.22";
    for (let i = 0; i < 5; i++) expect(freshCheck(ip, "general").ok).toBe(true);
    expect(freshCheck(ip, "general").ok).toBe(false);
    delete process.env.RATE_LIMIT_PER_MINUTE;
    freshReset();
    // need to re-import original? not needed; reset env
  });

  it("returns remaining and limit correctly", () => {
    const ip = "33.33.33.33";
    const r1 = checkRateLimit(ip, "auth");
    expect(r1.limit).toBe(30);
    expect(r1.remaining).toBe(29);
    const r2 = checkRateLimit(ip, "auth");
    expect(r2.remaining).toBe(28);
  });

  it("prunes stale timestamps on access (sliding window)", () => {
    const ip = "44.44.44.44";
    // 10 requests at t=0
    for (let i = 0; i < 10; i++) checkRateLimit(ip, "auth");
    // Advance 30s, 10 more
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 10; i++) checkRateLimit(ip, "auth");
    // At t=30s, window contains 20 entries (both batches inside 60s)
    const storeKey = `auth:${ip}`;
    expect(_store.get(storeKey)?.length).toBe(20);
    // Advance to 61s from start (31s more) — first batch should be pruned
    vi.advanceTimersByTime(31_000);
    checkRateLimit(ip, "auth");
    // After prune, first batch (10) gone, second batch (10) + new 1 = 11
    expect(_store.get(storeKey)?.length).toBe(11);
  });
});
