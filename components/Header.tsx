"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authHeaders } from "@/lib/authHeaders";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import PlanBadge from "@/components/PlanBadge";
import type { Plan } from "@/lib/plan";
import Link from "next/link";

export default function Header() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<Plan>("free");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email || "Unknown User");

      // Resolve the tier via the authoritative /api/plan endpoint; any failure
      // leaves the default 'free' so the badge never breaks the header.
      try {
        const res = await fetch("/api/plan", { headers: await authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as { plan?: Plan };
          if (data.plan) setPlan(data.plan);
        }
      } catch {
        // keep default 'free'
      }
    }

    loadUser();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="mx-auto mb-7 flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-4 rounded-2xl border border-white bg-white/90 p-4 shadow-[0_12px_40px_rgba(53,40,90,0.08)] backdrop-blur">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">Creator workspace</p>
        <h2 className="text-xl font-black tracking-tight sm:text-2xl">Welcome back</h2>

        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-slate-500">{email}</p>
          <PlanBadge plan={plan} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <form action="/search" className="order-last w-full sm:order-none sm:w-auto">
          <label className="sr-only" htmlFor="workspace-search">Search shows or episodes</label>
          <input id="workspace-search" name="q" type="search" placeholder="Search shows or episodes…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:w-64" />
        </form>

        <NotificationBell />

        <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-violet-200" aria-label="Open account settings">
          {email ? email.substring(0, 2).toUpperCase() : "SS"}
        </Link>

        <button
          onClick={handleSignOut}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
