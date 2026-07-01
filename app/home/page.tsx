import Link from "next/link";

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-8">
        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            SoundStage Live
          </p>

          <h1 className="mt-4 max-w-4xl text-6xl font-bold">
            Create, publish, and share podcasts from anywhere.
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-white/80">
            A complete podcast production platform for recording, AI editing,
            show notes, cover art, publishing, and public listening pages.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900"
            >
              Creator Dashboard
            </Link>

            <Link
              href="/public-shows"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white"
            >
              Browse Shows
            </Link>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Record</h2>
            <p className="mt-3 text-slate-600">
              Capture podcast audio directly in the browser and save it to your
              production workspace.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Edit with AI</h2>
            <p className="mt-3 text-slate-600">
              Generate transcripts, show notes, descriptions, publish packages,
              and artwork.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Publish</h2>
            <p className="mt-3 text-slate-600">
              Create public episode and show pages so listeners can discover and
              play your podcast.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}