"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authHeaders } from "@/lib/authHeaders";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import PlanBadge from "@/components/PlanBadge";
import type { Plan } from "@/lib/plan";

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
    <header className="mb-8 flex items-center justify-between rounded-xl bg-white p-4 shadow">
      <div>
        <h2 className="text-2xl font-bold">
          Welcome back
        </h2>

        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-slate-500">{email}</p>
          <PlanBadge plan={plan} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search shows or episodes..."
          className="w-72 rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-blue-500"
        />

        <NotificationBell />

        <button
          onClick={handleSignOut}
          className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white"
        >
          Sign Out
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
          {email ? email.substring(0, 2).toUpperCase() : "SS"}
        </div>
      </div>
    </header>
  );
}