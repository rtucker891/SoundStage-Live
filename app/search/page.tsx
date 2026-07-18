import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PublicNav from "@/components/public/PublicNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search shows, episodes, and transcripts on SoundStage Live.",
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type TranscriptHit = {
  episode_id: string;
  title: string;
  guest: string | null;
  cover_art_url: string | null;
  show_title: string | null;
  show_cover_art_url: string | null;
  snippet: string | null;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  // PostgREST's .or() filter uses commas and parentheses as syntax, so strip
  // those from the raw query before interpolating into an ilike pattern. The
  // transcript RPC receives the query as a bound parameter, so it needs no
  // sanitizing.
  const safeQuery = query.replace(/[,()]/g, " ");

  // Run all three searches in parallel when there's a query. Shows and
  // episodes use case-insensitive matching on their key fields; transcripts
  // go through the search_transcripts() database function, which searches the
  // full spoken text and returns a matching snippet.
  const [showsRes, episodesRes, transcriptsRes] = query
    ? await Promise.all([
        supabase
          .from("shows")
          .select("id, title, description, cover_art_url")
          .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
          .limit(12),
        supabase
          .from("episodes")
          .select("id, title, guest, cover_art_url, shows(title, cover_art_url)")
          .eq("status", "Published")
          .is("deleted_at", null)
          .or(`title.ilike.%${safeQuery}%,guest.ilike.%${safeQuery}%`)
          .limit(12),
        supabase.rpc("search_transcripts", { search_query: query }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const shows = showsRes.data ?? [];
  const episodes = episodesRes.data ?? [];
  const transcriptHits = (transcriptsRes.data ?? []) as TranscriptHit[];

  const totalResults =
    shows.length + episodes.length + transcriptHits.length;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <PublicNav />

        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Search SoundStage Live
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            Find shows, episodes, and moments
          </h1>

          <form className="mt-8 flex max-w-2xl gap-3">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search podcasts, episodes, guests, or spoken words..."
              className="w-full rounded-xl px-4 py-3 text-slate-900"
            />

            <button className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900">
              Search
            </button>
          </form>

          {query && (
            <p className="mt-4 text-sm text-white/70">
              {totalResults === 0
                ? `No results for “${query}”.`
                : `${totalResults} result${
                    totalResults === 1 ? "" : "s"
                  } for “${query}”`}
            </p>
          )}
        </section>

        {!query ? (
          <p className="mt-10 text-slate-500">
            Type something above to search across every public show, episode,
            and transcript.
          </p>
        ) : (
          <>
            {/* Shows */}
            <section className="mt-10">
              <h2 className="text-3xl font-bold">
                Shows{" "}
                <span className="text-lg font-normal text-slate-400">
                  ({shows.length})
                </span>
              </h2>

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

                      <h3 className="mt-4 text-xl font-bold">{show.title}</h3>

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

            {/* Episodes */}
            <section className="mt-12">
              <h2 className="text-3xl font-bold">
                Episodes{" "}
                <span className="text-lg font-normal text-slate-400">
                  ({episodes.length})
                </span>
              </h2>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {episodes.length === 0 ? (
                  <p className="text-slate-500">No episodes found.</p>
                ) : (
                  episodes.map((episode) => {
                    const artwork =
                      episode.cover_art_url ||
                      (episode.shows as { cover_art_url?: string } | null)
                        ?.cover_art_url ||
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
                          {(episode.shows as { title?: string } | null)
                            ?.title || "Podcast Episode"}
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

            {/* Transcripts — matches inside the spoken text of episodes */}
            <section className="mt-12">
              <h2 className="text-3xl font-bold">
                In Transcripts{" "}
                <span className="text-lg font-normal text-slate-400">
                  ({transcriptHits.length})
                </span>
              </h2>

              <div className="mt-6 grid gap-4">
                {transcriptHits.length === 0 ? (
                  <p className="text-slate-500">
                    No spoken-word matches found.
                  </p>
                ) : (
                  transcriptHits.map((hit) => {
                    const artwork =
                      hit.cover_art_url || hit.show_cover_art_url || "";

                    return (
                      <Link
                        key={hit.episode_id}
                        href={`/listen/${hit.episode_id}`}
                        className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
                      >
                        {artwork ? (
                          <img
                            src={artwork}
                            alt={hit.title}
                            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-xl text-white">
                            🎙
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-500">
                            {hit.show_title || "Podcast Episode"}
                          </p>
                          <h3 className="text-lg font-bold">{hit.title}</h3>
                          {hit.snippet && (
                            <p className="mt-1 text-sm italic text-slate-600">
                              {hit.snippet}
                            </p>
                          )}
                        </div>
                      </Link>
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
