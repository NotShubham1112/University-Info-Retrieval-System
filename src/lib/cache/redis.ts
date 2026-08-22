import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let warned = false;

function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn("[redis] unavailable; caching disabled");
}

export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== "false";
}

function getClient(): RedisClientType | null {
  if (!isRedisEnabled()) return null;
  if (!client) {
    const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 1000);
    client = createClient({ url, socket: { connectTimeout } });
  }
  return client;
}

export function getRedisClient(): RedisClientType | null {
  return getClient();
}

async function ensureConnected(): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  if (c.isReady) return true;
  try {
    await c.connect();
    return true;
  } catch {
    warnOnce();
    return false;
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  const c = getClient();
  if (!c || !(await ensureConnected())) return false;
  if (value === undefined) return false;
  try {
    await c.set(key, JSON.stringify(value) as string, {
      expiration: { type: "EX", value: ttlSeconds },
    });
    return true;
  } catch {
    warnOnce();
    return false;
  }
}

export async function redisGet<T = unknown>(key: string): Promise<T | null> {
  const c = getClient();
  if (!c || !(await ensureConnected())) return null;
  let raw: string | null;
  try {
    raw = await c.get(key);
  } catch {
    warnOnce();
    return null;
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const c = getClient();
  if (!c || !(await ensureConnected())) return false;
  try {
    await c.del(key);
    return true;
  } catch {
    warnOnce();
    return false;
  }
}

export async function redisPing(): Promise<string | null> {
  const c = getClient();
  if (!c || !(await ensureConnected())) return null;
  try {
    return await c.ping();
  } catch {
    warnOnce();
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  const c = client;
  if (!c) return;
  try {
    await c.close();
  } catch {
    warnOnce();
  }
  client = null;
}