import AppShell from "@/components/AppShell";

export default function PublishPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Publish</h1>
          <p className="mt-2 text-slate-600">
            Prepare show notes, schedule release, and export your episode.
          </p>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
          Schedule Release
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Episode Details</h2>

          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-lg border border-slate-200 px-4 py-3"
              placeholder="Episode title"
              defaultValue="Building Better Podcasts"
            />

            <textarea
              className="h-40 w-full rounded-lg border border-slate-200 px-4 py-3"
              placeholder="Show notes"
              defaultValue="In this episode, we discuss browser-based podcast production, remote recording, and AI-powered editing."
            />

            <input
              className="w-full rounded-lg border border-slate-200 px-4 py-3"
              placeholder="Tags"
              defaultValue="podcasting, audio, live streaming, AI"
            />
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Distribution</h2>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">RSS Feed</span>
              <span className="text-sm text-slate-500">Ready</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Spotify</span>
              <span className="text-sm text-slate-500">Not connected</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Apple Podcasts</span>
              <span className="text-sm text-slate-500">Not connected</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">YouTube</span>
              <span className="text-sm text-slate-500">Not connected</span>
            </div>
          </div>

          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
            Export Audio
          </button>
        </div>
      </div>
    </AppShell>
  );
}