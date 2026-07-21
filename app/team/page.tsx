"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import { getShows } from "@/lib/api";
import type { Show } from "@/types/show";

export default function TeamPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShows().then(setShows).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-purple-700 to-fuchsia-600 p-7 text-white shadow-xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/65">Collaborate</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Your SoundStage team</h1>
        <p className="mt-3 max-w-2xl text-white/80">Choose a show to invite collaborators, manage roles, and keep production moving together.</p>
      </section>

      <section className="mt-7 rounded-3xl border border-violet-100 bg-white p-6 shadow-[0_14px_40px_rgba(53,40,90,0.07)]">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Shows</p><h2 className="mt-1 text-2xl font-black">Manage collaborators by show</h2></div>
          <Link href="/shows" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Manage shows</Link>
        </div>
        {loading ? <p className="mt-6 text-slate-500">Loading your shows…</p> : shows.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-bold">Create a show before inviting collaborators.</p><Link href="/shows" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white">Create a show</Link></div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shows.map((show) => <Link key={show.id} href={`/shows/${show.id}/team`} className="rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 font-black text-violet-700">◎</span><h3 className="mt-4 font-black">{show.title}</h3><p className="mt-1 text-sm text-slate-500">Open team settings →</p></Link>)}
          </div>
        )}
      </section>
    </AppShell>
  );
}
