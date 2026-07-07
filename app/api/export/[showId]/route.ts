import { NextResponse } from "next/server";
import { admin, roleOnShow } from "@/lib/teamServer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ showId: string }> };

/**
 * GET /api/export/{showId}?token=…
 *
 * Downloads a full JSON export of a show: its settings, every episode, each
 * episode's show notes, and the audio URLs. This is the user's own portable
 * copy of their data (#56) — "move out" of the platform whenever they like.
 *
 * Auth note: this is a direct browser download (the user clicks a link and the
 * browser saves a file), so a normal Authorization header isn't available. We
 * accept the Supabase access token as a `token` query param and verify it
 * server-side, then confirm the caller has a role on the show.
 */
export async function GET(request: Request, { params }: Props) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 500 });

  const { showId } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: userData } = await db.auth.getUser(token);
  const uid = userData?.user?.id;
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Must have any role on this show to export it.
  const role = await roleOnShow(db, showId, uid);
  if (!role) return NextResponse.json({ error: "No access to this show." }, { status: 403 });

  // ---- Gather everything ----
  const { data: show } = await db
    .from("shows")
    .select("*")
    .eq("id", showId)
    .single();
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });

  const { data: episodes } = await db
    .from("episodes")
    .select("*")
    .eq("show_id", showId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const episodeIds = (episodes ?? []).map((e) => e.id);

  const notesByEpisode = new Map<string, unknown[]>();
  const recordingsByEpisode = new Map<string, unknown[]>();
  if (episodeIds.length > 0) {
    const { data: notes } = await db
      .from("show_notes")
      .select("episode_id, title, summary, bullet_points, created_at")
      .in("episode_id", episodeIds);
    for (const n of notes ?? []) {
      const arr = notesByEpisode.get(n.episode_id) ?? [];
      arr.push(n);
      notesByEpisode.set(n.episode_id, arr);
    }

    const { data: recs } = await db
      .from("recordings")
      .select("episode_id, name, audio_url, duration, created_at")
      .in("episode_id", episodeIds);
    for (const r of recs ?? []) {
      const arr = recordingsByEpisode.get(r.episode_id) ?? [];
      arr.push(r);
      recordingsByEpisode.set(r.episode_id, arr);
    }
  }

  const exportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    source: "SoundStage Live",
    show,
    episodes: (episodes ?? []).map((e) => ({
      ...e,
      showNotes: notesByEpisode.get(e.id) ?? [],
      recordings: recordingsByEpisode.get(e.id) ?? [],
    })),
    counts: {
      episodes: episodes?.length ?? 0,
    },
  };

  // A filesystem-safe file name from the show title.
  const safeName =
    (show.title || "show")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "show";

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="soundstage-${safeName}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
