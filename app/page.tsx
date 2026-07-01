import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PublicNav from "@/components/public/PublicNav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: shows = [] } = await supabase
    .from("shows")
    .select("id, title, description, cover_art_url")
    .limit(6);

  const { data: episodes = [] } = await supabase
    .from("episodes")
    .select(
      "id, title, guest, cover_art_url, shows(title, cover_art_url)"
    )
    .eq("status", "Published")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <PublicNav />

        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            SoundStage Live
          </p>

          <h1 className="mt-4 text-6xl font-bold">
            Create, Publish, and Share Podcasts
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-white/80">
            Record episodes, generate AI content, create artwork,
            publish shows, and grow your audience.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900"
            >
              Creator Dashboard
            </Link>

            <Link
              href="/browse"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white"
            >
              Browse Shows
            </Link>
          </div>

          <form
            action="/search"
            className="mt-8 flex max-w-2xl gap-3"
          >
            <input
              name="q"
              placeholder="Search shows, episodes, or guests..."
              className="w-full rounded-xl px-4 py-3 text-slate-900"
            />

            <button className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900">
              Search
            </button>
          </form>
        </section>

        <section id="featured-shows" className="mt-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Featured Podcasts
          </p>

          <h2 className="text-3xl font-bold">
            Browse Shows
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {shows.length === 0 ? (
              <p className="text-slate-500">
                No public shows available yet.
              </p>
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
          <p className="text-sm font-semibold uppercase tracking-wide text-pink-600">
            Latest Episodes
          </p>

          <h2 className="text-3xl font-bold">
            Recently Published
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {episodes.length === 0 ? (
              <p className="text-slate-500">
                No published episodes yet.
              </p>
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

        <section className="mt-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Explore Categories
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Find content you love
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Link
              href="/search?q=technology"
              className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
            >
              <h3 className="font-bold">Technology</h3>
            </Link>

            <Link
              href="/search?q=science"
              className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
            >
              <h3 className="font-bold">Science</h3>
            </Link>

            <Link
              href="/search?q=business"
              className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
            >
              <h3 className="font-bold">Business</h3>
            </Link>

            <Link
              href="/search?q=education"
              className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
            >
              <h3 className="font-bold">Education</h3>
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-3xl bg-white p-10 shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Why SoundStage Live
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Everything you need to produce a podcast
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-xl font-bold">
                Browser Recording
              </h3>
              <p className="mt-2 text-slate-600">
                Record directly in your browser.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold">
                AI Production
              </h3>
              <p className="mt-2 text-slate-600">
                Generate transcripts, notes, and artwork.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold">
                Publishing
              </h3>
              <p className="mt-2 text-slate-600">
                Publish episodes and public pages.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 rounded-3xl bg-slate-900 p-8 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                SoundStage Live
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Create, publish, and share podcasts from anywhere.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            © 2026 SoundStage Live. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}