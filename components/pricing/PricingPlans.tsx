"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

type Interval = "month" | "year";
type PaidPlan = "creator" | "studio" | "studio_plus";

/**
 * Client-side pricing cards. The monthly/annual toggle is shared across all
 * cards, so it lives here rather than on the server page. Paid CTAs POST to
 * /api/stripe/checkout and redirect to the returned Stripe Checkout URL; if the
 * visitor isn't signed in we send them to /login first.
 */
export default function PricingPlans() {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<PaidPlan | null>(null);

  async function choosePlan(plan: PaidPlan) {
    setBusy(plan);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login?next=/pricing");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan, interval }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.url) {
        alert(data.error || "Could not start checkout. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const annual = interval === "year";
  const creatorPrice = annual ? "$120" : "$12";
  const creatorUnit = annual ? "/yr" : "/mo";
  const studioPrice = annual ? "$290" : "$29";
  const studioUnit = annual ? "/yr" : "/mo";
  const studioPlusPrice = annual ? "$500" : "$50";
  const studioPlusUnit = annual ? "/yr" : "/mo";

  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-semibold ${
            annual ? "text-slate-500" : "text-slate-900"
          }`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setInterval(annual ? "month" : "year")}
          className="relative h-7 w-14 rounded-full bg-indigo-600 transition"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
              annual ? "left-8" : "left-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold ${
            annual ? "text-slate-900" : "text-slate-500"
          }`}
        >
          Annual <span className="text-indigo-600">(save 2 months)</span>
        </span>
      </div>

      <section className="mt-10 grid items-start gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Free</h2>
          <p className="mt-2 text-slate-600">
            For getting your first show off the ground.
          </p>
          <p className="mt-6 text-4xl font-bold">
            $0<span className="text-lg font-medium text-slate-500">/mo</span>
          </p>

          <ul className="mt-6 space-y-3 text-slate-600">
            <li>✓ 1 show, up to 5 published episodes</li>
            <li>✓ Browser recording &amp; storage</li>
            <li>✓ Publish to Apple, Spotify &amp; more</li>
            <li>✓ AI toolkit (transcripts &amp; show notes)</li>
            <li>✓ Basic analytics</li>
          </ul>

          <Link
            href="/login?next=/dashboard"
            className="mt-6 block rounded-lg bg-slate-900 px-5 py-3 text-center font-semibold text-white"
          >
            Get started
          </Link>
        </div>

        <div className="rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-xl">
          <p className="text-sm font-semibold text-indigo-600">Most Popular</p>
          <h2 className="mt-2 text-2xl font-bold">Creator</h2>
          <p className="mt-2 text-slate-600">
            For serious creators ready to grow.
          </p>
          <p className="mt-6 text-4xl font-bold">
            {creatorPrice}
            <span className="text-lg font-medium text-slate-500">
              {creatorUnit}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {annual ? "$12/mo billed monthly" : "or $120/yr — save 2 months"}
          </p>

          <ul className="mt-6 space-y-3 text-slate-600">
            <li>✓ Everything in Free</li>
            <li>✓ Up to 3 shows, unlimited episodes</li>
            <li>✓ Live streaming</li>
            <li>✓ Full analytics</li>
            <li>✓ 3 team seats</li>
            <li>✓ Import your existing show (RSS)</li>
          </ul>

          <button
            type="button"
            onClick={() => choosePlan("creator")}
            disabled={busy !== null}
            className="mt-6 block w-full rounded-lg bg-indigo-600 px-5 py-3 text-center font-semibold text-white disabled:opacity-60"
          >
            {busy === "creator" ? "Starting…" : "Choose Creator"}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">Studio</h2>
          <p className="mt-2 text-slate-600">
            For power creators, teams, and networks.
          </p>
          <p className="mt-6 text-4xl font-bold">
            {studioPrice}
            <span className="text-lg font-medium text-slate-500">
              {studioUnit}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {annual ? "$29/mo billed monthly" : "or $290/yr — save 2 months"}
          </p>

          <div className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-px">
            <div className="rounded-[11px] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                New · Studio exclusive
              </p>
              <p className="mt-1 font-bold text-slate-900">AI Episode Studio</p>
              <p className="mt-1 text-sm text-slate-600">
                Finish recording, click once, and get a publish-ready episode —
                transcript, title, show notes, chapters, dead-air trim &amp; a
                shareable audiogram. Your live show with a producer built in.
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-slate-600">
            <li>✓ Everything in Creator</li>
            <li>✓ Unlimited shows &amp; episodes</li>
            <li>✓ Advanced analytics + export</li>
            <li>✓ 15 team seats</li>
            <li>✓ Priority support</li>
          </ul>

          <button
            type="button"
            onClick={() => choosePlan("studio")}
            disabled={busy !== null}
            className="mt-6 block w-full rounded-lg bg-slate-900 px-5 py-3 text-center font-semibold text-white disabled:opacity-60"
          >
            {busy === "studio" ? "Starting…" : "Choose Studio"}
          </button>
        </div>

        <div className="rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-xl">
          <p className="text-sm font-semibold text-amber-600">Top Tier</p>
          <h2 className="mt-2 text-2xl font-bold">Studio Plus</h2>
          <p className="mt-2 text-slate-600">
            For studios producing at the highest level.
          </p>
          <p className="mt-6 text-4xl font-bold">
            {studioPlusPrice}
            <span className="text-lg font-medium text-slate-500">
              {studioPlusUnit}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            {annual ? "$50/mo billed monthly" : "or $500/yr — save 2 months"}
          </p>

          <ul className="mt-6 space-y-3 text-slate-600">
            <li>✓ Everything in Studio</li>
            <li>✓ SoundStage Studio app (multitrack recording &amp; editing)</li>
            <li>✓ Migrate recordings to Live</li>
            <li>✓ Priority support</li>
          </ul>

          <button
            type="button"
            onClick={() => choosePlan("studio_plus")}
            disabled={busy !== null}
            className="mt-6 block w-full rounded-lg bg-gradient-to-r from-amber-500 to-purple-700 px-5 py-3 text-center font-semibold text-white disabled:opacity-60"
          >
            {busy === "studio_plus" ? "Starting…" : "Choose Studio Plus"}
          </button>
        </div>
      </section>
    </>
  );
}
