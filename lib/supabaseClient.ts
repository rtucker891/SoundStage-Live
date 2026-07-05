import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    );
  }
  return client;
}

/**
 * Lazily-initialized Supabase client.
 *
 * Using a Proxy means the underlying `createClient` call only runs the first
 * time a property is accessed (i.e. at request time), not when this module is
 * imported. That prevents build-time "supabaseUrl is required" errors during
 * Next.js page-data collection when env vars are not present at build time.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
