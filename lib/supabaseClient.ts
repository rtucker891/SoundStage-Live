import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    );
  }
  return client;
}

/**
 * Lazily-initialized Supabase browser client.
 *
 * Uses `@supabase/ssr`'s `createBrowserClient`, which persists the session in
 * COOKIES (not localStorage). That's what lets the server — the proxy guard and
 * server components — see the signed-in user and enforce auth before a protected
 * page renders.
 *
 * The Proxy means the underlying client is created only on first property
 * access (i.e. at request time), not at import time, which prevents build-time
 * "supabaseUrl is required" errors during Next.js page-data collection when env
 * vars are not present at build time.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
