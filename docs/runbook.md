# SoundStage Live — Operator Runbook

Internal runbook for people who deploy and operate SoundStage Live. For the
end-user feature walkthrough see `docs/user-guide.md`. For backup/restore
procedures see `docs/backups-and-recovery.md`.

_Last updated: Phase 12 (production hardening)._

---

## 1. Architecture overview

SoundStage Live is a **Next.js 16 / React 19** app (App Router, TypeScript)
deployed on **Vercel**, backed by **Supabase**.

- **Frontend + API** — Next.js on Vercel. UI is server/client React components;
  server-side work runs in **Route Handlers** under `app/api/*` (many are
  `export const dynamic = "force-dynamic"`).
- **Database** — Supabase **Postgres**. Access is governed by **Row Level
  Security (RLS)**. Some server routes use the **service-role key** (bypasses
  RLS) and enforce access checks in code.
- **Auth** — Supabase **Auth** (email-based accounts, JWT access tokens). The
  browser client uses the anon key; the JWT identifies the caller. Server routes
  verify the caller via `auth.getUser(jwt)` or a bearer token.
- **Storage** — Supabase **Storage**, two buckets:
  - `soundstage-assets` — **PRIVATE**. Working files (unpublished audio,
    uploads).
  - `soundstage-public` — **PUBLIC**. Published audio and cover art served to
    listeners and podcast directories.
- **AI features** — OpenAI (transcription, show notes, chapters, artwork, etc.)
  via server routes using a server-side API key.

Key app modules:

- `lib/api.ts` — data-access layer (shows, episodes, analytics, tags, audit).
- `lib/teamServer.ts` — service-role helpers + caller/role resolution for team
  routes.
- `lib/rssImport.ts` — server-only RSS feed parser (no DB access).
- `lib/audit.ts` + `app/api/audit/record/route.ts` — audit logging.
- `lib/guard.ts` — rate limiting + input validation helpers.

---

## 2. Deploy process

Deploys are **Git-driven via Vercel**:

- **Push to `main` → auto-deploy to production.** Merging/pushing to `origin main`
  triggers a Vercel production build and deploy.
- Pull requests get **preview deployments** automatically.
- Rollback: in the Vercel dashboard, promote a previous successful deployment.

Before pushing to `main`, locally verify:

```bash
npx tsc --noEmit        # types must be clean
npm run build           # must compile with no errors
npm test                # unit tests must pass (vitest)
```

Database schema changes are applied as **additive migrations** to Supabase (via
the Supabase connector / SQL). Prefer additive, least-privilege changes and never
break existing RLS. See §4 for a pending migration.

---

## 3. Environment variables

Set these in Vercel (Production + Preview) and locally in `.env.local`:

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public (client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-scoped) | Public (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **bypasses RLS**; server only | **Secret** |
| `OPENAI_API_KEY` | OpenAI access for AI features | **Secret** |
| `RESEND_API_KEY` | Email delivery (guest invites, notifications) | **Secret** (optional; features are a safe no-op until set) |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for building links (e.g. invite URLs) | Public (optional; falls back to request origin) |

Never expose the service-role or OpenAI keys to the client. `NEXT_PUBLIC_*`
values are bundled into the browser build by design.

---

## 4. Security posture

### RLS model
Access control is enforced primarily by **Postgres RLS** on Supabase. RLS
policies use **`SECURITY DEFINER` helper functions** to answer "does the current
user have access to this show?" without recursive policy evaluation:

- `has_show_access`, `show_role`, `can_edit_show`, `can_manage_show`,
  `ensure_owner_membership`.

These are **by design** and safe to expose: they check the **caller's own**
access (they answer questions about `auth.uid()`), so a caller can only learn
about their own permissions, not anyone else's. `ensure_owner_membership` is a
trigger function. **Do not change these** to silence linters unless you have
verified RLS policy evaluation still works.

### Analytics functions — hardened (see pending migration)
The analytics RPCs `analytics_daily`, `analytics_top_episodes`,
`analytics_totals` are `SECURITY DEFINER` and originally accepted a caller-
supplied `owner_id`. Because SECURITY DEFINER bypasses RLS, a caller could pass
**someone else's** `owner_id` and read their analytics.

**Fix (pending apply):** `phase12-analytics-fix.sql` (repo workspace root)
revokes direct `EXECUTE` on those functions from `anon`/`authenticated` and adds
`*_secure` wrapper functions that derive the owner from `auth.uid()` internally
(so the parameter can't be spoofed). The app (`lib/api.ts`) already calls the
`*_secure` wrappers and sends **no** `owner_id`. **Operator action:** apply
`phase12-analytics-fix.sql` via the Supabase connector, then confirm the
analytics dashboard still loads.

`search_transcripts(search_query text)` powers the **public** search page over
**published** content and takes no `owner_id`, so anon access is by design and it
was left unchanged. Recommended follow-up: confirm its body filters to published
episodes only.

### Rate limiting
`lib/guard.ts` provides a lightweight **in-memory** rate limiter applied to
sensitive routes (import, import/preview, team add/remove/role, export, invite
send). **Limitation:** the counter lives in a single serverless instance's
memory and is **not shared across Vercel instances** — it's best-effort throttling
for runaway loops and casual abuse, not a hard global guarantee.
**Follow-up:** back it with a shared store (**Upstash Redis**) for strict global
limits.

### Input validation
`lib/guard.ts` also provides `isUuid`, `isEmail`, `cleanString`, `isOneOf`,
applied at route boundaries to reject malformed input before it reaches the DB.

### Audit log
The audit log (`audit_log` table, written via `lib/audit.ts` /
`app/api/audit/record/route.ts`) is **append-only and tamper-resistant**: entries
are inserted, never updated or deleted, and the **actor is stamped server-side**
from the verified session (clients cannot forge who did what). `recordAudit`
**never throws**, so audit failures can't break the underlying action.

### Storage
`soundstage-assets` is private; `soundstage-public` is public (published audio /
art). See §6 accepted risks re: public bucket listing.

---

## 5. Accepted / known risks

| Risk | Assessment | Action |
| --- | --- | --- |
| **npm audit: 2 moderate** — `postcss` XSS (GHSA-qx2v-qp2m-jg93) pulled in transitively via `next`. | The only "fix" is `npm audit fix --force`, which **downgrades `next` to 9.3.3** (breaking major). It's a transitive dev-time CSS tooling dep, **not a runtime exploit path** for this app. | **Accepted.** Do **not** force-fix. **Revisit on the next Next.js upgrade** (it resolves when Next bumps bundled postcss). |
| **Leaked-password protection disabled** (HaveIBeenPwned check). | Supabase **Auth dashboard setting**, not code. | **Recommended:** enable in Supabase → Auth → Password settings. |
| **Public bucket allows listing** (`soundstage-public`). | Low risk — files are public audio/art anyway; listing only exposes the file inventory. Object URLs don't require listing. | **Accepted / optional tighten:** optionally scope the `storage.objects` SELECT policy to disallow listing. |
| **Rate limiting is per-instance in-memory.** | Best-effort only (see §4). | **Follow-up:** move to Upstash Redis for global limits. |

Sentry / error monitoring is **intentionally not integrated** in this phase.

---

## 6. Backup & recovery

Database and storage backup/restore procedures are documented in
**`docs/backups-and-recovery.md`**. In brief: Supabase takes automatic daily
Postgres backups (PITR available as an add-on) and storage is covered there too.
Consult that runbook for exact restore steps before performing any recovery.

Users can also self-export a show's data as JSON (see the user guide) — a
per-show portable copy, not a substitute for platform backups.

---

## 7. On-call / incident checklist

When something breaks in production:

1. **Assess scope** — Is it the whole app, one feature, or one show? Check the
   Vercel deployment status and the Supabase project status page.
2. **Recent change?** — Look at the latest deploy on `main`. If the incident
   started right after a deploy, **roll back** by promoting the previous good
   deployment in Vercel.
3. **Database/Auth/Storage** — Check the Supabase dashboard for outages, quota
   limits, or failed migrations. Confirm RLS policies weren't inadvertently
   changed.
4. **Env/config** — Verify required env vars (§3) are present in the affected
   environment; a missing `SUPABASE_SERVICE_ROLE_KEY` will 500 the server routes
   that need it (they fail safe with "Server not configured").
5. **Abuse / spikes** — If a route is being hammered, the in-memory limiter helps
   but isn't global; consider temporarily disabling the affected feature or
   fast-tracking the Upstash follow-up.
6. **Audit trail** — Use the per-show Activity log / `audit_log` to see what
   changed and by whom.
7. **Data loss** — Follow `docs/backups-and-recovery.md`. Do not attempt
   destructive fixes without a current backup.
8. **Communicate & record** — Note the timeline, impact, and resolution for a
   post-incident review; file follow-up work for root-cause fixes.
