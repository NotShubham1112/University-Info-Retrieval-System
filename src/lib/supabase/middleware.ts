import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Same oversized-cookie guard as in src/middleware.ts - prevents
  // "Size of a request header field exceeds server limit" on next request
  // when refresh_token_not_found leaves chunked cookies accumulating.
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.length > 7000 && !request.nextUrl.pathname.startsWith("/login")) {
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

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Don't redirect if already on /login - avoids loop and lets page render
    if (request.nextUrl.pathname.startsWith("/login")) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve Set-Cookie headers that clear invalid/corrupted auth cookies.
    // Returning a fresh NextResponse.redirect() would discard supabaseResponse's
    // Set-Cookie (e.g. clearing refresh_token_not_found), leaving the oversized
    // Cookie header on the client and causing "header field exceeds server limit".
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    // Also ensure stale chunked cookies (sb-*-auth-token.0, .1, ...) are cleared
    // if Supabase didn't already emit a clearing Set-Cookie.
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
  return supabaseResponse;
}