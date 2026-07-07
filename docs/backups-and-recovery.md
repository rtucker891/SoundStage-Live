# SoundStage Live — Backups & Recovery Runbook (#57)

_Last updated: Phase 11 (data portability)._

This runbook explains **how SoundStage Live data is backed up** and the **exact
steps to recover** if something goes wrong. It covers two kinds of data:

1. **The database** (Postgres, on Supabase) — shows, episodes, members, notes,
   analytics, notifications, etc.
2. **Storage** (files) — audio, cover art, and other uploads in the Supabase
   storage buckets `soundstage-assets` (private) and `soundstage-public`
   (public).

---

## 1. What backs up automatically

### Database (Supabase automatic backups)
Supabase takes **automatic daily backups** of the Postgres database on paid
plans, with point-in-time recovery (PITR) available as an add-on.

- **Where:** Supabase Dashboard → Project → **Database → Backups**.
- **Retention:** depends on plan (typically 7 days of daily backups on Pro; PITR
  extends this to a rolling window you can restore to any second within).
- **Action needed from us:** confirm the project is on a plan that includes
  daily backups. If the app holds anything you can't afford to lose, enable
  **PITR** for second-level recovery.

> ⚠️ **Free-tier note:** Supabase's free tier does **not** include automatic
> backups. If this project is on free tier, rely on the **manual exports** below
> until it's upgraded.

### Storage (files)
Supabase Storage is **not** covered by the database backup. Audio and images
live in object storage and must be backed up separately (see §3).

---

## 2. Per-show export (built into the app — #56)

Every show has an **Export** button (Shows page → Export). It downloads a single
JSON file containing the show's settings, all episodes, show notes, and the
audio URLs. This is a **portable, user-owned copy** — good for:

- Moving a show to another platform.
- Keeping an off-platform snapshot before a risky change.
- Handing a creator their data on request.

It does **not** bundle the raw audio bytes (only URLs). For a full media backup,
see §3.

---

## 3. Full manual backup (recommended weekly, or before big changes)

### 3a. Database dump
Use the Supabase CLI (or `pg_dump` with the connection string from
Dashboard → **Project Settings → Database**):

```bash
# One-time: install the CLI — https://supabase.com/docs/guides/cli
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup-$(date +%Y%m%d).sql
```

Store the resulting `.sql` file somewhere durable (e.g. an encrypted cloud
drive). This captures **all tables and data**.

### 3b. Storage (files) backup
Mirror both buckets to local disk or another bucket. The simplest path is the
Supabase Storage API or the CLI; for large libraries, `rclone` against the S3
endpoint works well:

```bash
# Example with the Supabase storage S3-compatible endpoint + rclone.
rclone sync supabase:soundstage-public ./backup/public-$(date +%Y%m%d)
rclone sync supabase:soundstage-assets ./backup/assets-$(date +%Y%m%d)
```

Keep the two buckets in separate folders so a restore is unambiguous.

---

## 4. Recovery procedures

### 4a. Restore the whole database (disaster)
1. Supabase Dashboard → **Database → Backups**.
2. Pick the most recent good backup (or a PITR timestamp _before_ the incident).
3. Click **Restore**. This overwrites current data — confirm you truly want the
   snapshot.
4. After restore, **re-check the auto-owner-membership trigger** exists
   (`trg_ensure_owner_membership` on `shows`) and RLS policies are intact, since
   a very old snapshot could predate them.

### 4b. Restore from a manual `pg_dump`
```bash
psql "$SUPABASE_DB_URL" -f backup-YYYYMMDD.sql
```
Run against a **staging** project first if possible, verify, then production.

### 4c. Restore a single show (from an app export)
The export JSON is human-readable. To rebuild a lost show:
1. Create a new show (or use RSS import if the show still has a live feed).
2. Use the JSON's `episodes[]` to recreate episodes and re-attach audio URLs.
   (A small import script can automate this from the export file — the shape
   matches the `episodes` table plus nested `showNotes` and `recordings`.)

### 4d. Restore files
Copy the backed-up objects back into the matching bucket/path with the CLI or
`rclone` (reverse of §3b). Paths must match what the database rows reference
(e.g. `published/{showId}/cover.png`, `imported/{showId}/{episodeId}.mp3`).

---

## 5. Recovery checklist (print this)

- [ ] Confirm the incident scope: DB only? Files only? Both?
- [ ] Stop writes if data is actively corrupting (put the app in maintenance).
- [ ] Restore DB from the most recent clean backup / PITR point.
- [ ] Restore storage buckets to match the DB snapshot's timeframe.
- [ ] Verify: `trg_ensure_owner_membership` trigger present; RLS policies on
      `shows`, `episodes`, `show_memberships` present.
- [ ] Spot-check: open a show, play an episode, load the RSS feed, sign in as a
      team member.
- [ ] Re-enable writes.
- [ ] Write a short post-mortem: what happened, what was lost, what changed.

---

## 6. Ownership & cadence

| Task | Cadence | Owner |
|------|---------|-------|
| Confirm Supabase daily backups are on | Monthly | Admin |
| Manual `pg_dump` + storage mirror | Weekly (or pre-migration) | Admin |
| Test-restore into staging | Quarterly | Admin |
| Review this runbook | Each release | Admin |

_A backup you've never restored is a hope, not a backup. Test-restore quarterly._
