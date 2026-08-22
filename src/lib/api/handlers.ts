import { NextResponse } from "next/server";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Error shape: { error: { code, message } }
// ---------------------------------------------------------------------------
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function fail(
  status: number,
  message: string,
  code: ApiErrorCode = "BAD_REQUEST",
  extraHeaders?: Record<string, string>,
): NextResponse {
  const res = NextResponse.json(
    { error: { code, message } },
    { status },
  );
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.headers.set(k, v);
    }
  }
  // Mutations and errors: never cache
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function ok<T>(
  data: T,
  opts?: { cacheControl?: string; headers?: Record<string, string> },
): NextResponse {
  const res = NextResponse.json(data);
  if (opts?.cacheControl) {
    res.headers.set("Cache-Control", opts.cacheControl);
  }
  if (opts?.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// parseQuery / parseBody helpers — use safeParse, return 400 shape on failure
// ---------------------------------------------------------------------------
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
):
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse } {
  const obj: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) obj[k] = v;
  const result = schema.safeParse(obj);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      response: fail(400, message || "Invalid query parameters"),
    };
  }
  return { success: true, data: result.data as z.infer<T> };
}

export async function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  request: Request,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      success: false,
      response: fail(400, "Invalid JSON body"),
    };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      response: fail(400, message || "Invalid body"),
    };
  }
  return { success: true, data: result.data as z.infer<T> };
}

// ---------------------------------------------------------------------------
// Cache-Control helpers
// ---------------------------------------------------------------------------
export function cacheControlValue(ttlSeconds: number): string {
  // public, max-age + stale-while-revalidate for graceful degradation
  return `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`;
}

export function setCacheControl(
  response: NextResponse,
  ttlSeconds: number,
): NextResponse {
  response.headers.set("Cache-Control", cacheControlValue(ttlSeconds));
  return response;
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
