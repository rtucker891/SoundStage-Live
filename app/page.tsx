import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: latestEpisodesData } = await supabase
  .from("episodes")
  .select("id, title, guest, status, shows(title)")
  .eq("status", "Published")
  .order("created_at", { ascending: false })
  .limit(3);

  const latestEpisodes = latestEpisodesData ?? [];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl bg-white p-5 shadow">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-xl text-white shadow">
              🎙️
            </div>

            <div>
              <div className="text-2xl font-black text-slate-900">
                SoundStage Live
              </div>

              <div className="text-xs uppercase tracking-widest text-slate-500">
                Create. Publish. Be Heard.
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-semibold text-slate-700">
            <Link href="/">Home</Link>
            <Link href="/browse">Browse Shows</Link>
            <Link href="/search">Search</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-900 px-5 py-3 text-white"
            >
              Dashboard
            </Link>
          </nav>
        </header>

        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-6 lg:p-8">
              <p className="text-sm font-bold uppercase tracking-wide text-purple-400">
                SoundStage Live
              </p>

              <h1 className="mt-3 text-4xl font-black leading-tight lg:text-5xl">
                Create, Publish, and Share Podcasts
              </h1>

              <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/80">
                Record episodes, generate AI content, create artwork,
                publish shows, and grow your audience.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-3 font-bold text-white shadow-lg"
                >
                  Creator Dashboard
                </Link>

                <Link
                  href="/browse"
                  className="rounded-xl border border-white/40 px-6 py-3 font-bold text-white"
                >
                  Browse Shows
                </Link>
              </div>

              <form
                action="/search"
                className="mt-8 flex max-w-2xl overflow-hidden rounded-xl bg-white shadow-lg"
              >
                <input
                  name="q"
                  placeholder="Search shows, episodes, or guests..."
                  className="w-full px-5 py-4 text-slate-900 outline-none"
                />

                <button className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-7 py-4 font-bold text-white">
                  Search
                </button>
              </form>
            </div>

            <div className="relative h-[380px] overflow-hidden">
              <img
                src="/images/hero-podcaster.png"
                alt="Podcast Host"
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-slate-950/30" />

              <div className="absolute right-6 top-6 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                ON AIR
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">AI Production</h2>
            <p className="mt-3 text-slate-600">
              Generate transcripts, show notes, episode descriptions, artwork,
              and social media content automatically.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Video Podcasts</h2>
            <p className="mt-3 text-slate-600">
              Record, edit, and publish both audio and video podcasts from a
              single platform.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Global Distribution</h2>
            <p className="mt-3 text-slate-600">
              Publish to RSS feeds, Spotify, Apple Podcasts, YouTube, and other
              major platforms.
            </p>
          </div>
        </section>

      <section className="mt-16">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-purple-600">
        Featured Podcasts
      </p>

      <h2 className="text-3xl font-black text-slate-900">
        Discover New Shows
      </h2>
    </div>

    <Link
      href="/browse"
      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
    >
      View All Shows
    </Link>
  </div>

  <div className="grid gap-6 md:grid-cols-3">

    <Link
      href="/podcasts/technology-today"
      className="rounded-2xl bg-white p-4 shadow transition hover:-translate-y-1 hover:shadow-xl"
    >
      <img
        src="/images/technology-show.png"
        alt="Technology Today"
        className="aspect-square w-full rounded-xl object-cover"
      />

      <h3 className="mt-4 text-xl font-bold">
        Technology Today
      </h3>

      <p className="mt-2 text-slate-600">
        AI, software, and emerging technology.
      </p>
    </Link>

    <Link
      href="/podcasts/business-growth"
      className="rounded-2xl bg-white p-4 shadow transition hover:-translate-y-1 hover:shadow-xl"
    >
      <img
        src="/images/business-show.png"
        alt="Business Growth"
        className="aspect-square w-full rounded-xl object-cover"
      />

      <h3 className="mt-4 text-xl font-bold">
        Business Growth
      </h3>

      <p className="mt-2 text-slate-600">
        Entrepreneurship and leadership.
      </p>
    </Link>

    <Link
      href="/podcasts/health-wellness"
      className="rounded-2xl bg-white p-4 shadow transition hover:-translate-y-1 hover:shadow-xl"
    >
      <img
        src="/images/health-show.png"
        alt="Health & Wellness"
        className="aspect-square w-full rounded-xl object-cover"
      />

      <h3 className="mt-4 text-xl font-bold">
        Health & Wellness
      </h3>

      <p className="mt-2 text-slate-600">
        Fitness, nutrition, and healthy living.
      </p>
    </Link>

  </div>
</section>
 <section className="mt-16">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-pink-600">
        Latest Episodes
      </p>

      <h2 className="text-3xl font-black text-slate-900">
        Recently Published
      </h2>
    </div>

    <Link
      href="/browse-episodes"
      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
    >
      View All Episodes
    </Link>
  </div>

  <div className="grid gap-6 md:grid-cols-3">
    {latestEpisodes.length === 0 ? (
      <p className="text-slate-500">
        No published episodes yet.
      </p>
    ) : (
      latestEpisodes.map((episode) => (
        <div
          key={episode.id}
          className="rounded-2xl bg-white p-6 shadow"
        >
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
            {(episode.shows as any)?.title || "SoundStage Live"}
          </p>

          <h3 className="mt-2 text-xl font-bold">
            {episode.title}
          </h3>

          <p className="mt-3 text-slate-600">
            Guest: {episode.guest || "No guest listed"}
          </p>

          <Link
            href={`/listen/${episode.id}`}
            className="mt-5 inline-block rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white"
          >
            Listen Now
          </Link>
        </div>
      ))
    )}
  </div>
</section>
        <footer className="mt-16 rounded-3xl bg-slate-950 p-8 text-white">
  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-2xl font-black">SoundStage Live</h2>
      <p className="mt-2 text-sm text-slate-300">
        Create, publish, and share podcasts from anywhere.
      </p>
    </div>

    <div className="flex flex-wrap gap-5 text-sm font-semibold text-slate-300">
      <Link href="/">Home</Link>
      <Link href="/browse">Browse Shows</Link>
      <Link href="/search">Search</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/about">About</Link>
      <Link href="/contact">Contact</Link>
    </div>
  </div>

  <p className="mt-6 text-sm text-slate-500">
    © 2026 SoundStage Live. All rights reserved.
  </p>
</footer>
      </div>
    </main>
  );
}