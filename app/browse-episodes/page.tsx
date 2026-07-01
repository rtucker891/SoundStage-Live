import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PublicNav from "@/components/public/PublicNav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BrowseEpisodesPage() {
  const { data: episodes = [] } = await supabase
    .from("episodes")
    .select("id, title, guest, cover_art_url, created_at, shows(title, cover_art_url)")
    .eq("status", "Published")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <PublicNav />

        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Browse Episodes
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            Listen to the latest episodes
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-white/80">
            Discover recently published podcast episodes from SoundStage Live creators.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          {episodes.length === 0 ? (
            <p className="text-slate-500">No published episodes yet.</p>
          ) : (
            episodes.map((episode) => {
              const artwork =
                episode.cover_art_url ||
                (episode.shows as any)?.cover_art_url ||
                "";

              return (
                <div key={episode.id} className="rounded-2xl bg-white p-6 shadow">
                  {artwork ? (
                    <img
                      src={artwork}
                      alt={episode.title}
                      className="h-48 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                      No Artwork
                    </div>
                  )}

                  <p className="mt-4 text-sm text-slate-500">
                    {(episode.shows as any)?.title || "Podcast Episode"}
                  </p>

                  <h2 className="mt-1 text-xl font-bold">{episode.title}</h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Guest: {episode.guest || "No guest listed"}
                  </p>

                  <Link
                    href={`/listen/${episode.id}`}
                    className="mt-4 inline-block rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Listen Now
                  </Link>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}