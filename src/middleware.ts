import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/api/rate-limit";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // NextRequest.ip is available in middleware runtime (edge/node)
  const maybeIp = (request as unknown as { ip?: string }).ip;
  if (maybeIp) return maybeIp;
  return "unknown";
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/api/auth") || pathname.startsWith("/auth");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit only API routes — skip static/assets and non-API pages
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const routeGroup = isAuthRoute(pathname) ? "auth" : "general";
    const result = checkRateLimit(ip, routeGroup);
    if (!result.ok) {
      const res = NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(result.retryAfterSec));
      res.headers.set("X-RateLimit-Limit", String(result.limit));
      res.headers.set("X-RateLimit-Remaining", String(result.remaining));
      return res;
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/search/:path*",
    "/students/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
