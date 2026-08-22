export const SEARCH_LIMIT = 50;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

// TTL table (seconds) — single source of truth re-exported by cache/index.ts
// Kept here so DB-adjacent code can import without pulling LRU/Redis.
export const CACHE_TTL = {
  profile: 60,
  search: 10,
  stats: 30,
  reference: 300,
  fee: 300,
  course: 300,
  list: 60,
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;
