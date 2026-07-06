import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type GuestRow = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  deleted_at: string | null;
};

async function loadGuest(id: string): Promise<GuestRow | null> {
  const { data } = await supabase
    .from("guests")
    .select(
      "id, name, bio, photo_url, website_url, twitter_url, linkedin_url, deleted_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  return data as GuestRow;
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const guest = await loadGuest(id);
  if (!guest) return { title: "Guest Not Found" };
  const description = guest.bio || `Podcast appearances by ${guest.name}.`;
  return {
    title: `${guest.name} — Guest`,
    description,
    openGraph: {
      title: guest.name,
      description,
      type: "profile",
      images: guest.photo_url ? [{ url: guest.photo_url }] : undefined,
    },
  };
}

export default async function GuestProfilePage({ params }: Props) {
  const { id } = await params;
  const guest = await loadGuest(id);

  if (!guest) {
    return (
      <main className="mx-auto max-w-3xl p-10">
        <h1 className="text-3xl font-bold">Guest Not Found</h1>
        <Link
          href="/browse"
          className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Browse shows
        </Link>
      </main>
    );
  }

  // Published episodes this guest appears on.
  const { data: linkRows } = await supabase
    .from("episode_guests")
    .select(
      "episodes(id, title, show_id, published_at, status, deleted_at)"
    )
    .eq("guest_id", id);

  type EpRow = {
    id: string;
    title: string;
    show_id: string;
    published_at: string | null;
    status: string;
    deleted_at: string | null;
  };
  const rows = (linkRows ?? []) as unknown as { episodes: EpRow | null }[];
  const episodes = rows
    .map((r) => r.episodes)
    .filter(
      (e): e is EpRow =>
        Boolean(e) && e!.status === "Published" && !e!.deleted_at
    )
    .sort((a, b) =>
      (b.published_at || "").localeCompare(a.published_at || "")
    );

  const links: { label: string; url: string }[] = [];
  if (guest.website_url) links.push({ label: "Website", url: guest.website_url });
  if (guest.twitter_url) links.push({ label: "X / Twitter", url: guest.twitter_url });
  if (guest.linkedin_url) links.push({ label: "LinkedIn", url: guest.linkedin_url });

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl p-8">
        <Link
          href="/browse"
          className="mb-6 inline-block text-sm font-semibold text-purple-600"
        >
          ← Browse all shows
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={guest.photo_url || "/default-cover.png"}
              alt={guest.name}
              className="h-28 w-28 flex-shrink-0 rounded-full object-cover"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold">{guest.name}</h1>
              {guest.bio && (
                <p className="mt-3 text-slate-600">{guest.bio}</p>
              )}
              {links.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:border-purple-400 hover:text-purple-600"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <h2 className="mt-10 text-xl font-bold">
          Appearances ({episodes.length})
        </h2>
        {episodes.length === 0 ? (
          <p className="mt-3 text-slate-500">
            No published episodes featuring this guest yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {episodes.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/listen/${e.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-purple-300"
                >
                  <span className="font-semibold">{e.title}</span>
                  {e.published_at && (
                    <span className="ml-2 text-sm text-slate-500">
                      {new Date(e.published_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
