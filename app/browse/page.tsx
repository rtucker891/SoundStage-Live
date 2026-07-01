import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PublicNav from "@/components/public/PublicNav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function BrowseShowsPage() {
  const { data: shows = [] } = await supabase
    .from("shows")
    .select("id, title, description, cover_art_url")
    .order("created_at", { ascending: false });

  return (
   <main className="min-h-screen bg-slate-100">
  <div className="mx-auto max-w-7xl p-8">
    <PublicNav />
        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Browse Podcasts
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            Discover shows on SoundStage Live
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-white/80">
            Explore public podcast shows created and published with SoundStage Live.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
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

                <h2 className="mt-4 text-xl font-bold">
                  {show.title}
                </h2>

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
        </section>

        <div className="mt-10">
          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}