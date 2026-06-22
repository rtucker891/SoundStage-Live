import AppShell from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell>
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-slate-600">
          Manage your workspace, team, recording preferences, and publishing
          options.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Workspace</h2>

          <div className="mt-6 space-y-4">
            <input
              className="w-full rounded-lg border border-slate-200 px-4 py-3"
              defaultValue="SoundStage Live Workspace"
            />

            <input
              className="w-full rounded-lg border border-slate-200 px-4 py-3"
              defaultValue="Rawle Tucker"
            />

            <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">
              Save Workspace
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Recording Preferences</h2>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Separate Speaker Tracks</span>
              <span className="text-sm text-slate-500">Enabled</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">AI Mic Check</span>
              <span className="text-sm text-slate-500">Enabled</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-4">
              <span className="font-semibold">Auto Transcript</span>
              <span className="text-sm text-slate-500">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}