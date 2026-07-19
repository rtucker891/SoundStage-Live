import Link from "next/link";

import AppShell from "@/components/AppShell";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import ManageBilling from "@/components/settings/ManageBilling";
import PlanBadge, { PLAN_LABELS } from "@/components/PlanBadge";
import { getCurrentUserPlan } from "@/lib/supabaseServer";

export default async function SettingsPage() {
  const plan = await getCurrentUserPlan();

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
        <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Your plan</h2>
            <PlanBadge plan={plan} />
          </div>
          <p className="mt-2 text-slate-600">
            {plan === "free"
              ? "You're on the Free plan. Upgrade to unlock Creator and Studio features."
              : `You're on the ${PLAN_LABELS[plan]} plan.`}
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-semibold text-white"
          >
            {plan === "free" ? "Upgrade plan" : "Change plan"}
          </Link>
        </div>

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

        <ManageBilling />

        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}