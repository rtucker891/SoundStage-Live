"use client";

import { supabase } from "@/lib/supabaseClient";

/**
 * Build the Authorization header our API routes expect (a Supabase Bearer
 * token). Server guards read this via callerId() to identify the signed-in user.
 * Returns an empty object when there's no session so anonymous callers simply
 * get a 401 from the route rather than a client-side crash.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}
