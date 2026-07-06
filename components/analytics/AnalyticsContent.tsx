"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getAnalyticsDaily,
  getAnalyticsTopEpisodes,
  getAnalyticsTotals,
  type AnalyticsDailyRow,
  type AnalyticsTopEpisode,
  type AnalyticsTotal,
} from "@/lib/api";

// Friendly labels for the raw event type strings.
const TYPE_LABELS: Record<string, string> = {
  "show.viewed": "Show views",
  "episode.viewed": "Episode views",
  "episode.listened": "Listens",
  "episode.downloaded": "Downloads",
};

// The date-range options the creator can toggle between.
const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export default function AnalyticsContent() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<AnalyticsTotal[]>([]);
  const [daily, setDaily] = useState<AnalyticsDailyRow[]>([]);
  const [topEpisodes, setTopEpisodes] = useState<AnalyticsTopEpisode[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAnalyticsTotals(days),
      getAnalyticsDaily(days),
      getAnalyticsTopEpisodes(days, 5),
    ])
      .then(([totalsData, dailyData, topData]) => {
        setTotals(totalsData);
        setDaily(dailyData);
        setTopEpisodes(topData);
      })
      .finally(() => setLoading(false));
  }, [days]);

  // Helper: pull the recent (windowed) total for one event type.
  function recentTotal(type: string): number {
    return totals.find((t) => t.type === type)?.recent ?? 0;
  }

  // Build a day-by-day series of listens for the simple bar chart. We fill in
  // every day in the window (even zero days) so the chart reads as a real
  // timeline instead of a sparse set of bars.
  const listenSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of daily) {
      if (row.type === "episode.listened") {
        byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.count);
      }
    }

    const series: { day: string; count: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ day: key, count: byDay.get(key) ?? 0 });
    }
    return series;
  }, [daily, days]);

  const maxListen = Math.max(1, ...listenSeries.map((s) => s.count));
  const totalListensInWindow = listenSeries.reduce((a, s) => a + s.count, 0);

  const kpiTypes = [
    "episode.listened",
    "episode.viewed",
    "show.viewed",
    "episode.downloaded",
  ];

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
              SoundStage Live
            </p>
            <h1 className="mt-2 text-4xl font-bold">Analytics</h1>
            <p className="mt-3 text-white/80">
              Views, listens, and downloads across your shows and episodes.
            </p>
          </div>

          <div className="flex gap-2">
            {RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  days === range.days
                    ? "bg-white text-slate-900"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <p className="text-slate-500">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {kpiTypes.map((type) => (
              <div
                key={type}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow"
              >
                <p className="text-sm font-semibold text-slate-500">
                  {TYPE_LABELS[type]}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {recentTotal(type).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  last {days} days
                </p>
              </div>
            ))}
          </div>

          {/* Listens over time (simple CSS bar chart) */}
          <div className="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                  Over Time
                </p>
                <h3 className="text-2xl font-bold">Listens per day</h3>
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                {totalListensInWindow.toLocaleString()} total
              </span>
            </div>

            {totalListensInWindow === 0 ? (
              <p className="mt-6 text-slate-500">
                No listens recorded yet in this window. As people play your
                published episodes, this chart will fill in.
              </p>
            ) : (
              <div className="mt-6 flex h-48 items-end gap-1">
                {listenSeries.map((point) => (
                  <div
                    key={point.day}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    title={`${point.day}: ${point.count} listens`}
                  >
                    <div
                      className="w-full rounded-t bg-indigo-500 transition-all group-hover:bg-indigo-600"
                      style={{
                        height: `${(point.count / maxListen) * 100}%`,
                        minHeight: point.count > 0 ? "4px" : "0px",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top episodes */}
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                  Leaderboard
                </p>
                <h3 className="text-2xl font-bold">Top episodes</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                By listens
              </span>
            </div>

            {topEpisodes.length === 0 ? (
              <p className="mt-6 text-slate-500">
                No episode listens yet. Your most-played episodes will be ranked
                here.
              </p>
            ) : (
              <ol className="mt-6 space-y-3">
                {topEpisodes.map((episode, index) => (
                  <li
                    key={episode.episodeId}
                    className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                      {index + 1}
                    </span>
                    <Link
                      href={`/listen/${episode.episodeId}`}
                      className="flex-1 font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {episode.title}
                    </Link>
                    <span className="font-bold text-slate-900">
                      {episode.listens.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-400">listens</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </>
  );
}
