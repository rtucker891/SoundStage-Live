import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Reads the session from the request cookies (written by the browser client and
 * refreshed by the root proxy). Writing cookies during a Server Component render
 * is not allowed by Next.js, so `setAll` is wrapped in try/catch — the proxy is
 * responsible for persisting refreshed sessions.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — safe to ignore because
            // the proxy refreshes the session on the next request.
          }
        },
      },
    }
  );
}

/**
 * Server-side auth gate for protected pages/layouts (defense in depth behind the
 * proxy). Returns the authenticated user, or redirects to /login when there is
 * no valid session.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
