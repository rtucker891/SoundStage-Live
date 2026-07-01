import Link from "next/link";
import PublicNav from "@/components/public/PublicNav";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <PublicNav />
        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            About SoundStage Live
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            A podcast production platform for modern creators.
          </h1>

          <p className="mt-6 max-w-3xl text-xl text-white/80">
            SoundStage Live helps creators record, edit, package, publish,
            and share podcasts from one simple workspace.
          </p>
        </section>

        <section className="mt-10 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-3xl font-bold">
            What SoundStage Live Does
          </h2>

          <p className="mt-4 text-slate-600">
            SoundStage Live combines browser recording, AI transcription,
            show notes, podcast artwork, publishing tools, and public
            podcast pages into one creator platform.
          </p>

          <p className="mt-4 text-slate-600">
            The goal is to make podcast production easier for solo creators,
            small teams, studios, agencies, educators, and media companies.
          </p>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h3 className="text-xl font-bold">Create</h3>
            <p className="mt-3 text-slate-600">
              Plan shows, record episodes, and organize production assets.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h3 className="text-xl font-bold">Produce</h3>
            <p className="mt-3 text-slate-600">
              Use AI to generate transcripts, descriptions, and show notes.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h3 className="text-xl font-bold">Publish</h3>
            <p className="mt-3 text-slate-600">
              Share public show and episode pages with listeners.
            </p>
          </div>
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