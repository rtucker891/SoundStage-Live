import AppShell from "@/components/AppShell";

export default function StudioPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Studio</h1>
          <p className="mt-2 text-slate-600">
            Record solo or with guests directly in the browser.
          </p>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
          Start Recording
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Recording Room</h2>
          <p className="mt-2 text-slate-600">
            Prepare your session before going live or recording.
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Microphone</span>
              <span className="text-sm text-slate-500">Ready</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Guest Link</span>
              <span className="text-sm text-slate-500">Available</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Recording Timer</span>
              <span className="text-sm text-slate-500">00:00</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Mic Check</h2>
          <p className="mt-2 text-slate-600">
            Analyze your microphone setup before recording.
          </p>

          <div className="mt-6 rounded-lg bg-slate-100 p-4">
            <p className="font-semibold">AI Sound Check</p>
            <p className="mt-2 text-sm text-slate-500">
              Background noise, echo, and input level will appear here.
            </p>
          </div>

          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">
            Run Mic Check
          </button>
        </div>
      </div>
    </AppShell>
  );
}