import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireEpisodeRole } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// Persist AI-generated chapter markers (#31) onto the episode row.
//
// Chapters are stored as a JSON array on episodes.chapters, e.g.
//   [ { "startTime": 0, "title": "Introduction" }, ... ]
// The RSS feed reads this column to embed <podcast:chapters>-style data so
// podcast apps can show clickable chapter navigation.
export async function POST(request: Request, { params }: Props) {
  try {
    const { id: episodeId } = await params;

    const guard = await requireEpisodeRole(request, episodeId, "episode-chapters");
    if (!guard.ok) return guard.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase credentials." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const incoming = Array.isArray(body?.chapters) ? body.chapters : null;

    if (!incoming) {
      return NextResponse.json(
        { error: "A chapters array is required." },
        { status: 400 }
      );
    }

    // Sanitize: keep only well-formed entries, coerce types, sort by time.
    const chapters = incoming
      .map((c: { startTime?: unknown; title?: unknown }) => ({
        startTime: Number(c?.startTime) || 0,
        title: typeof c?.title === "string" ? c.title.trim() : "",
      }))
      .filter((c: { title: string }) => c.title.length > 0)
      .sort(
        (a: { startTime: number }, b: { startTime: number }) =>
          a.startTime - b.startTime
      );

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: episode, error: epErr } = await admin
      .from("episodes")
      .select("id")
      .eq("id", episodeId)
      .single();

    if (epErr || !episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const { error: updErr } = await admin
      .from("episodes")
      .update({ chapters })
      .eq("id", episodeId);

    if (updErr) {
      return NextResponse.json(
        { error: `Could not save chapters: ${updErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, chapters });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Chapter save failed: ${message}` },
      { status: 500 }
    );
  }
}
