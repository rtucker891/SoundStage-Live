import { requireUser } from "@/lib/apiAuth";
import { getPlan, isStudioPlan } from "@/lib/plan";
import { studioJson, studioOptions, withStudioCors } from "@/lib/studioBridge";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return studioOptions();
}

export async function GET(request: Request) {
  const auth = await requireUser(request, "studio-shows", 60, 60_000);
  if (!auth.ok) return withStudioCors(auth.response);
  if (!isStudioPlan(await getPlan(auth.db, auth.uid))) return studioJson({ error: "The Studio plan is required." }, 403);

  const [{ data: memberships, error: membershipError }, { data: ownedShows, error: ownedError }] = await Promise.all([
    auth.db.from("show_memberships").select("show_id").eq("user_id", auth.uid),
    auth.db.from("shows").select("id, title").eq("user_id", auth.uid).is("deleted_at", null).order("title"),
  ]);
  if (membershipError) return studioJson({ error: membershipError.message }, 500);
  if (ownedError) return studioJson({ error: ownedError.message }, 500);

  const showIds = [...new Set((memberships ?? []).map((row) => row.show_id as string))];
  if (!showIds.length) return studioJson({ shows: ownedShows ?? [] });

  const { data: shows, error } = await auth.db
    .from("shows")
    .select("id, title")
    .in("id", showIds)
    .is("deleted_at", null)
    .order("title");
  if (error) return studioJson({ error: error.message }, 500);

  const combined = new Map((ownedShows ?? []).map((show) => [show.id, show]));
  for (const show of shows ?? []) combined.set(show.id, show);
  return studioJson({ shows: [...combined.values()].sort((a, b) => a.title.localeCompare(b.title)) });
}
