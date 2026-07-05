import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PublicNav from "@/components/public/PublicNav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BrowseShowsPage() {
  const { data } = await supabase
    .from("shows")
    .select("id, title, description, cover_art_url")
    .order("created_at", { ascending: false });

  const shows = data || [];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <PublicNav />

        <section className="overflow-hidden rounded-3xl bg-slate-950 p-10 text-white shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-purple-400">
            Browse Podcasts
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Discover shows on SoundStage Live
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Explore public podcast shows created and published with SoundStage
            Live.
          </p>

          <form
            action="/search"
            className="mt-8 flex max-w-2xl overflow-hidden rounded-xl bg-white shadow-lg"
          >
            <input
              name="q"
              placeholder="Search shows, creators, or topics..."
              className="w-full px-5 py-4 text-slate-900 outline-none"
            />

            <button className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-7 py-4 font-bold text-white">
              Search
            </button>
          </form>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          {shows.length === 0 ? (
            <p className="text-slate-500">No public shows available yet.</p>
          ) : (
            shows.map((show) => (
              <Link
                key={show.id}
                href={`/public-shows/${show.id}`}
                className="rounded-3xl bg-white p-5 shadow transition hover:-translate-y-1 hover:shadow-xl"
              >
                {show.cover_art_url ? (
                  <img
                    src={show.cover_art_url}
                    alt={show.title}
                    className="aspect-square w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-center text-lg font-black text-white">
                    SoundStage Live
                  </div>
                )}

                <h2 className="mt-4 text-xl font-black text-slate-900">
                  {show.title}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {show.description || "Podcast show"}
                </p>

                <div className="mt-4 text-sm font-bold text-purple-600">
                  View Show →
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  );
}