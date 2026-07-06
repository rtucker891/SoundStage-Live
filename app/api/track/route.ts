import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Which event types this endpoint accepts. Locking this down prevents the
// public endpoint from being used to write arbitrary junk into the table.
const ALLOWED_TYPES = new Set([
  "show.viewed",
  "episode.viewed",
  "episode.listened",
  "episode.downloaded",
]);

// The entity behind each event type, so we can resolve the correct show owner
// and stamp the event with their user_id (that's what makes the owner's
// dashboard fill up from anonymous public traffic).
function entityKind(type: string): "show" | "episode" | null {
  if (type === "show.viewed") return "show";
  if (
    type === "episode.viewed" ||
    type === "episode.listened" ||
    type === "episode.downloaded"
  )
    return "episode";
  return null;
}

/**
 * Record a single analytics event.
 *
 * Public pages POST here with { type, entityId }. This runs server-side with
 * the service-role key so:
 *   1. The browser never gets write access to the events table.
 *   2. We can look up the show/episode owner and attribute the event to them,
 *      even though the viewer is anonymous.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      // Fail quietly: analytics should never break a page.
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const body = await request.json();
    const type: string = body?.type || "";
    const entityId: string = body?.entityId || "";

    if (!ALLOWED_TYPES.has(type) || !entityId) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const kind = entityKind(type);
    if (!kind) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve the owner of the entity so the event is attributed correctly.
    // We also confirm the entity exists, which rejects spoofed/random ids.
    const table = kind === "show" ? "shows" : "episodes";
    const { data: entity } = await admin
      .from(table)
      .select("id, user_id")
      .eq("id", entityId)
      .single();

    if (!entity?.user_id) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    await admin.from("events").insert({
      user_id: entity.user_id,
      type,
      entity_id: entityId,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics failures must be invisible to the user experience.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
