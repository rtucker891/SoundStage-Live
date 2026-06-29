import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function PublicShowPage({ params }: Props) {
  const { id } = await params;

  const { data: show } = await supabase
    .from("shows")
    .select("*")
    .eq("id", id)
    .single();

  if (!show) {
    return (
      <main className="mx-auto max-w-4xl p-10">
        <h1 className="text-3xl font-bold">Show Not Found</h1>
      </main>
    );
  }

  const { data: episodes = [] } = await supabase
    .from("episodes")
    .select("*")
    .eq("show_id", id)
    .eq("status", "Published")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-10 text-white shadow-xl">
          <p className="text-sm uppercase tracking-wide text-white/70">
            SoundStage Live Show
          </p>

          <h1 className="mt-3 text-5xl font-bold">
            {show.title}
          </h1>

          <p className="mt-4 text-lg text-white/80">
            {show.description || "Podcast show page"}
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold">Episodes</h2>

          {episodes.length === 0 ? (
            <p className="mt-4 text-slate-500">
              No published episodes yet.
            </p>
          ) : (
            <div className="mt-6 grid gap-4">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <h3 className="text-xl font-bold">
                    {episode.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Guest: {episode.guest || "No guest listed"}
                  </p>

                  <Link
                    href={`/listen/${episode.id}`}
                    className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Listen to Episode
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Powered by SoundStage Live
          </Link>
        </div>
      </div>
    </main>
  );
}