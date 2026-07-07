# SoundStage Live — User Guide

Welcome to SoundStage Live, a platform for producing, publishing, and growing a
podcast. This guide walks you through everything you can do as a creator, from
starting your first show to reviewing your activity log.

---

## 1. Creating a show

A **show** is your podcast. It holds your episodes, cover art, team, and
settings.

1. Sign in and go to **Shows**.
2. Click **New show**.
3. Give it a **title** and **description**, pick a **category**, and set the
   **language** and **explicit** flag (used in your RSS feed and public pages).
4. Upload **cover art** (a square image works best). This appears on your public
   show page, in podcast directories, and next to your episodes.
5. Save. You are automatically the show **owner**.

You can edit any of these later from the show's settings.

---

## 2. Adding episodes

1. Open a show and click **New episode**.
2. Enter a **title**, **guest** (optional), and a **description**. You can write
   the description yourself or generate a draft with the AI assistant.
3. Set the episode **status** — **Draft** while you work, **Published** when it's
   ready to go live (see [Publishing](#5-publishing)).
4. Save. The episode now appears in the show's episode list.

Each episode can also have its own cover art, show notes, chapters, and a
transcript.

---

## 3. Uploading or recording audio

Every episode needs an audio file. You have two options:

- **Upload** — drag in (or browse for) an existing audio file (e.g. MP3). It is
  stored privately until the episode is published.
- **Record** — use the in-browser recorder to capture audio directly, then save
  it to the episode.

After the audio is attached you can:

- **Transcribe** it — generate a searchable text transcript.
- Generate **show notes**, **chapters**, **highlights**, and **social posts**
  from the transcript using the AI tools.

---

## 4. Team roles

Shows can be run by a team. Invite collaborators from the show's **Team** page by
entering the email of someone who already has a SoundStage account, then choosing
a role. There are four roles, from most to least privileged:

| Role | Can do |
| --- | --- |
| **Owner** | Everything: edit the show, manage episodes, add/remove members, change roles, delete the show. There is exactly one owner and the owner cannot be removed or demoted. |
| **Producer** | Manage the show and episodes, and manage the team (add/remove members, change roles) — but cannot remove or demote the owner. |
| **Editor** | Create and edit episodes and content. Cannot manage the team. |
| **Host** | Contribute to episodes (e.g. as on-air talent). Limited editing. Cannot manage the team. |

Notes:

- Any member can **remove themselves** from a show ("leave"), except the owner.
- Only **owners** and **producers** can add members or change roles.
- All team changes are written to the [activity log](#8-activity-log).

---

## 5. Publishing

When an episode is ready:

1. Set its status to **Published**.
2. Publishing makes the episode public: it appears on your public show page and
   in your **RSS feed**, and its audio/cover art are served from public storage.

Unpublishing an episode reverses this — it returns to a non-public state and
drops out of the feed. Publishing and unpublishing are recorded in the activity
log.

Your show's RSS feed is what podcast apps (Apple Podcasts, Spotify, etc.)
subscribe to. Submit the feed URL to those directories once to be listed.

---

## 6. Importing from RSS

Moving an existing podcast to SoundStage? Use **Import from RSS**:

1. Go to **Import** and paste your existing podcast's **RSS feed URL**.
2. **Preview** — SoundStage fetches the feed and shows you the show details and
   the episodes it found (title, date, audio, duration, artwork).
3. Confirm to **import**. The show and its episodes are created for you,
   including audio links, descriptions, durations, and cover art where present.

The importer reads standard RSS 2.0 / iTunes podcast tags. Missing fields are
simply left blank — nothing fails if a feed is incomplete.

---

## 7. Exporting your data

You own your content and can take it with you at any time. From a show, use
**Export** to download a full **JSON** file containing the show's settings, every
episode, each episode's show notes, and the audio URLs. This is your portable
copy — useful for backups or moving off the platform.

---

## 8. Activity log

Every show has an **Activity** log (linked from the Shows list and the show
page). It's an append-only record of important actions, including:

- Team changes (member added, removed, role changed).
- Content lifecycle events (episode published/unpublished, show deleted).
- Imports.

Each entry records **who** did it, **what** they did, the **target**, and
**when**. The log is tamper-resistant — entries are added, never edited or
deleted — so you always have a trustworthy history of what happened.

---

## 9. Notifications

SoundStage keeps you informed with in-app **notifications** — for example, when
you're added to a show's team. Open the notifications area to see recent activity
relevant to you. (Email delivery for some notifications, such as guest invites,
activates once the operator configures the email provider.)

---

## Getting help

If something isn't working as described here, contact your show owner or the
platform operator. Operators: see `docs/runbook.md` for architecture, deploy, and
incident procedures.
