import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getUserRole, canAccessDashboard } from "@/lib/auth/rbac";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const maybeIp = (request as unknown as { ip?: string }).ip;
  if (maybeIp) return maybeIp;
  return "unknown";
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/api/auth") || pathname.startsWith("/auth");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Guard: Supabase chunked auth cookies can accumulate (sb-*-auth-token.0/.1/...)
  // and push Cookie header past Node's 8-16KB limit -> "header field exceeds
  // server limit" before middleware even runs on the NEXT request. Proactively
  // clear if we're already near the limit so the redirect can reset the browser.
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.length > 7000 && !pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-") && c.name.includes("-auth-token")) {
        res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    }
    return res;
  }

  // Rate limit only API routes — skip static/assets and non-API pages
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const routeGroup = isAuthRoute(pathname) ? "auth" : "general";
    const result = checkRateLimit(ip, routeGroup);
    if (!result.ok) {
      const res = NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(result.retryAfterSec));
      res.headers.set("X-RateLimit-Limit", String(result.limit));
      res.headers.set("X-RateLimit-Remaining", String(result.remaining));
      return res;
    }
  }

  // Dashboard RBAC: /dashboard/* requires auth; /dashboard/admin/* requires admin
  if (pathname.startsWith("/dashboard")) {
    // Create Supabase client with cookie handling for session refresh
    let supabaseResponse = NextResponse.next({ request });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If Supabase not configured (e.g. build/CI without env), fall back to updateSession behavior
    if (!supabaseUrl || !supabaseAnonKey) {
      return await updateSession(request);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      // Preserve Set-Cookie headers from Supabase (clears invalid refresh token)
      // instead of discarding them with a fresh redirect. Without this, the
      // corrupted Cookie header stays on the browser and triggers
      // "Size of a request header field exceeds server limit".
      const redirectResponse = NextResponse.redirect(url);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
      const hasClearingCookie = supabaseResponse.cookies
        .getAll()
        .some((c) => c.value === "");
      if (!hasClearingCookie) {
        for (const c of request.cookies.getAll()) {
          if (c.name.startsWith("sb-") && c.name.includes("-auth-token")) {
            redirectResponse.cookies.set(c.name, "", { maxAge: 0, path: "/" });
          }
        }
      }
      return redirectResponse;
    }

    if (pathname.startsWith("/dashboard/admin")) {
      const role = getUserRole(user as unknown as Parameters<typeof getUserRole>[0]);
      if (!canAccessDashboard(role, "admin")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/viewer";
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/search/:path*",
    "/students/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
