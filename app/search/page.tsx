import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PublicNav from "@/components/public/PublicNav";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const { data: shows = [] } = query
    ? await supabase
        .from("shows")
        .select("id, title, description, cover_art_url")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(12)
    : { data: [] };

  const { data: episodes = [] } = query
    ? await supabase
        .from("episodes")
        .select(
          "id, title, guest, cover_art_url, shows(title, cover_art_url)"
        )
        .eq("status", "Published")
        .or(`title.ilike.%${query}%,guest.ilike.%${query}%`)
        .limit(12)
    : { data: [] };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <PublicNav />

        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Search SoundStage Live
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            Find shows and episodes
          </h1>

          <form className="mt-8 flex max-w-2xl gap-3">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search podcasts, episodes, or guests..."
              className="w-full rounded-xl px-4 py-3 text-slate-900"
            />

            <button className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900">
              Search
            </button>
          </form>
        </section>

        {query && (
          <>
            <section className="mt-10">
              <h2 className="text-3xl font-bold">Shows</h2>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {shows.length === 0 ? (
                  <p className="text-slate-500">No shows found.</p>
                ) : (
                  shows.map((show) => (
                    <div
                      key={show.id}
                      className="rounded-2xl bg-white p-6 shadow"
                    >
                      {show.cover_art_url ? (
                        <img
                          src={show.cover_art_url}
                          alt={show.title}
                          className="h-48 w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                          No Artwork
                        </div>
                      )}

                      <h3 className="mt-4 text-xl font-bold">
                        {show.title}
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        {show.description || "Podcast show"}
                      </p>

                      <Link
                        href={`/public-shows/${show.id}`}
                        className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Show
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-3xl font-bold">Episodes</h2>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {episodes.length === 0 ? (
                  <p className="text-slate-500">No episodes found.</p>
                ) : (
                  episodes.map((episode) => {
                    const artwork =
                      episode.cover_art_url ||
                      (episode.shows as any)?.cover_art_url ||
                      "";

                    return (
                      <div
                        key={episode.id}
                        className="rounded-2xl bg-white p-6 shadow"
                      >
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
                          {(episode.shows as any)?.title ||
                            "Podcast Episode"}
                        </p>

                        <h3 className="mt-1 text-xl font-bold">
                          {episode.title}
                        </h3>

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
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}