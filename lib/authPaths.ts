/**
 * Path classification for route protection, shared by the root `proxy.ts`
 * (Next.js 16's renamed middleware) and its tests.
 *
 * A path is protected if it equals one of these prefixes or starts with one
 * followed by "/". Everything else is public by default.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/studio",
  "/analytics",
  "/editor",
  "/publish",
  "/settings",
  "/home",
  "/shows",
  "/episodes",
  "/guests",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
