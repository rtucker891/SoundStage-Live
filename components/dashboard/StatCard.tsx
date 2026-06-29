type StatCardProps = {
  title: string;
  value: number;
};

const iconMap: Record<string, string> = {
  Shows: "🎙",
  Episodes: "📺",
  Drafts: "📝",
  Recordings: "🎧",
};

export default function StatCard({
  title,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3 text-xl">
          {iconMap[title] || "✨"}
        </div>

        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Active
        </span>
      </div>

      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-5xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        Production workspace metric
      </p>
    </div>
  );
}