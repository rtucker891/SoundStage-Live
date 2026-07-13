"use client";

import { useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";

/**
 * "Billing" settings card. Opens the Stripe Billing Portal so the user can
 * update or cancel their subscription. If the user has never checked out (no
 * Stripe customer), the portal endpoint returns 400 and we point them at
 * /pricing instead.
 */
export default function ManageBilling() {
  const [busy, setBusy] = useState(false);

  async function openPortal() {
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Please sign in first.");
        return;
      }

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.url) {
        alert(data.error || "Could not open the billing portal.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("Could not open the billing portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold">Billing</h2>
      <p className="mt-2 text-slate-600">
        Manage your subscription, payment method, and invoices.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openPortal}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Opening…" : "Manage billing"}
        </button>

        <Link
          href="/pricing"
          className="rounded-lg border border-slate-200 px-5 py-3 font-semibold text-slate-700"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
