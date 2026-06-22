export default function Header() {
  return (
    <header className="mb-8 flex items-center justify-between rounded-xl bg-white p-4 shadow">
      <div>
        <h2 className="text-2xl font-bold">Welcome back, Rawle</h2>

        <p className="text-sm text-slate-500">
          Ready to create your next episode?
        </p>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search shows or episodes..."
          className="w-72 rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-blue-500"
        />

        <button className="rounded-lg border border-slate-200 px-4 py-2">
          Notifications
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
          RT
        </div>
      </div>
    </header>
  );
}