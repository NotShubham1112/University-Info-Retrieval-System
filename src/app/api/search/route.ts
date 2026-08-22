import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/validation/schemas";
import { parseQuery, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { getCachedOrSet, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(searchQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;

  const { q, limit, cursor } = parsed.data as {
    q: string;
    limit: number;
    cursor?: string | null;
  };

  // Never cache empty? Still cache but short TTL covers search prefix
  const cacheKey = buildCacheKey("GET", "/api/search", {
    q: q ?? "",
    limit,
    cursor: cursor ?? "",
  });
  const prefixedKey = `search:${cacheKey}`;

  try {
    const result = await getCachedOrSet(
      prefixedKey,
      CACHE_TTL.search,
      async () => {
        const supabase = await createServerClient();
        // Call RPC search_students(q, p_limit, p_cursor)
        const { data, error } = await supabase.rpc("search_students", {
          q: q ?? "",
          p_limit: limit,
          p_cursor: cursor ?? null,
        });
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as Array<{
          id: number;
          pnr: string;
          roll_number: string;
          first_name: string;
          last_name: string;
          search_name: string;
          program_id: number;
          status: string;
          course_id: number | null;
          category_id: number | null;
        }>;
        const nextCursor =
          rows.length === limit ? String(rows[rows.length - 1].id) : null;
        return { data: rows, nextCursor };
      },
    );

    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.search));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
