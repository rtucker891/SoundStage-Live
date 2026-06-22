import AppShell from "@/components/AppShell";

export default function EditorPage() {
  return (
    <AppShell>
      <div>
        <h1 className="text-3xl font-bold">Editor</h1>
        <p className="mt-2 text-slate-600">
          Edit audio using transcripts, waveform tools, and AI cleanup.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
          <h2 className="text-2xl font-bold">Transcript Editor</h2>
          <p className="mt-2 text-slate-600">
            Delete words or sections from the transcript to trim the recording.
          </p>

          <div className="mt-6 space-y-4 rounded-lg bg-slate-100 p-4">
            <p>
              <span className="font-bold">Host:</span> Welcome to SoundStage
              Live, where creators can record, edit, and publish from anywhere.
            </p>

            <p>
              <span className="font-bold">Guest:</span> The browser-based
              studio makes it easier to collaborate without installing extra
              software.
            </p>

            <p>
              <span className="font-bold">Host:</span> Today we are discussing
              AI audio tools, captions, and professional podcast workflows.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">AI Cleanup</h2>

          <div className="mt-6 space-y-3">
            <button className="w-full rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Enhance Speech
            </button>

            <button className="w-full rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Remove Silence
            </button>

            <button className="w-full rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Remove Filler Words
            </button>

            <button className="w-full rounded-lg border border-slate-200 p-4 text-left font-semibold">
              Caption Video
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow">
        <h2 className="text-2xl font-bold">Waveform Timeline</h2>

        <div className="mt-6 flex h-24 items-end gap-1 rounded-lg bg-slate-100 p-4">
          {Array.from({ length: 60 }).map((_, index) => (
            <div
              key={index}
              className="w-2 rounded bg-blue-600"
              style={{ height: `${20 + (index % 8) * 8}px` }}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}