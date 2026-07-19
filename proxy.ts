import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath } from "@/lib/authPaths";

/**
 * Route protection (Next.js 16 Proxy — the renamed `middleware`).
 *
 * Runs before protected pages render. It refreshes the Supabase session from
 * cookies and, for authenticated-only areas, redirects anonymous visitors to
 * /login?next=<original-path> so a protected page never renders for a signed-out
 * user. Public pages (landing, login, pricing, browse, listen, etc.) are left
 * untouched.
 */

export async function proxy(request: NextRequest) {
  // Start from a pass-through response so Supabase can attach refreshed
  // session cookies to it.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() revalidates the token with Supabase and refreshes it
  // when needed. Do not trust getSession() alone for auth decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on all app routes so sessions stay refreshed, but skip API routes, the
  // public RSS feed, Next.js internals, and static asset files.
  matcher: [
    "/((?!api|rss|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|mp3|m4a|webm|wav)$).*)",
  ],
};
