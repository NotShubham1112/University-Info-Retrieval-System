import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const client = {
    isReady: true,
    connect: vi.fn(async () => undefined),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    ping: vi.fn(async () => "PONG"),
    close: vi.fn(async () => undefined),
  };
  return { client, store, createClient: vi.fn(() => client) };
});

vi.mock("redis", () => ({ createClient: mocks.createClient }));

async function loadCache() {
  return await import("./redis");
}

describe("redis cache wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.store.clear();
    mocks.client.isReady = true;
    mocks.client.connect.mockReset();
    mocks.client.connect.mockImplementation(async () => undefined);
    process.env.REDIS_ENABLED = "true";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.REDIS_CONNECT_TIMEOUT_MS = "1000";
  });

  it("round-trips a JSON value through redisSet + redisGet", async () => {
    const { redisSet, redisGet } = await loadCache();
    const value = { name: "Aisha", scores: [91, 88] };
    await expect(redisSet("student:1", value, 60)).resolves.toBe(true);
    await expect(redisGet<typeof value>("student:1")).resolves.toEqual(value);
  });

  it("passes the TTL expiry to the client on redisSet", async () => {
    const { redisSet } = await loadCache();
    await redisSet("k", "v", 300);
    expect(mocks.client.set).toHaveBeenCalledWith("k", JSON.stringify("v"), {
      expiration: { type: "EX", value: 300 },
    });
  });

  it("returns null for a missing key", async () => {
    const { redisGet } = await loadCache();
    await expect(redisGet("nope")).resolves.toBeNull();
  });

  it("returns null instead of throwing when stored JSON is malformed", async () => {
    const { redisGet } = await loadCache();
    mocks.store.set("bad", "{not-json");
    await expect(redisGet("bad")).resolves.toBeNull();
  });

  it("deletes a key with redisDel", async () => {
    const { redisSet, redisDel, redisGet } = await loadCache();
    await redisSet("k", { a: 1 }, 60);
    await expect(redisDel("k")).resolves.toBe(true);
    await expect(redisGet("k")).resolves.toBeNull();
    expect(mocks.client.del).toHaveBeenCalledWith("k");
  });

  it("short-circuits without touching the client when disabled", async () => {
    process.env.REDIS_ENABLED = "false";
    const { redisSet, redisGet, redisDel, redisPing, getRedisClient } =
      await loadCache();
    await expect(redisSet("k", "v", 60)).resolves.toBe(false);
    await expect(redisGet("k")).resolves.toBeNull();
    await expect(redisDel("k")).resolves.toBe(false);
    await expect(redisPing()).resolves.toBeNull();
    expect(getRedisClient()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("is idempotent: getRedisClient returns the same instance", async () => {
    const { getRedisClient } = await loadCache();
    expect(getRedisClient()).toBe(getRedisClient());
  });

  it("returns null/false on connection failure (fallback path)", async () => {
    mocks.client.isReady = false;
    mocks.client.connect.mockRejectedValue(new Error("ECONNREFUSED"));
    const { redisGet, redisSet, redisDel, redisPing } = await loadCache();
    await expect(redisGet("k")).resolves.toBeNull();
    await expect(redisSet("k", "v", 60)).resolves.toBe(false);
    await expect(redisDel("k")).resolves.toBe(false);
    await expect(redisPing()).resolves.toBeNull();
  });

  it("redisPing returns the server response when connected", async () => {
    const { redisPing } = await loadCache();
    await expect(redisPing()).resolves.toBe("PONG");
  });
});