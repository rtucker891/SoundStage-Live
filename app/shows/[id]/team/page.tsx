"use client";

/**
 * Team management page (#35-39) — /shows/[id]/team
 *
 * Owners & producers land here to manage who can work on a show. They can:
 *  - see the current roster with each person's role,
 *  - add a member by email with a role,
 *  - change a member's role,
 *  - remove a member.
 * The owner row is protected (can't be changed or removed).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  addShowMember,
  changeMemberRole,
  getShowMembers,
  removeShowMember,
  type ShowMember,
} from "@/lib/api";

const ROLE_HELP: Record<string, string> = {
  owner: "Full control, including deleting the show and managing the team.",
  producer: "Everything except deleting the show. Can manage the team.",
  editor: "Create and edit episodes, upload audio, edit notes. Cannot manage the team.",
  host: "View the show and edit episode details. Lightest access.",
};

export default function TeamPage() {
  const params = useParams();
  const showId = String(params?.id || "");

  const [members, setMembers] = useState<ShowMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"producer" | "editor" | "host">("editor");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMembers(await getShowMembers(showId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the team.");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    // Hydrate on mount / when the show id changes. `load` sets a loading flag
    // before its async fetch; it's the same loader the mutation handlers call to
    // re-fetch (and to re-show the spinner), so deriving the flag during render
    // would drop that spinner. The synchronous set here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showId) load();
  }, [showId, load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await addShowMember(showId, email.trim(), role);
      setNotice(`Added ${res.email} as ${role}.`);
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(m: ShowMember, newRole: string) {
    setError("");
    setNotice("");
    try {
      await changeMemberRole(showId, m.userId, newRole as "producer" | "editor" | "host");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the role.");
    }
  }

  async function handleRemove(m: ShowMember) {
    if (!confirm(`Remove ${m.email || "this member"} from the show?`)) return;
    setError("");
    setNotice("");
    try {
      await removeShowMember(showId, m.userId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the member.");
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/shows" className="text-sm font-semibold text-blue-600">
          ← Back to shows
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Team</h1>
        <p className="mt-2 text-slate-600">
          Manage who can work on this show and what they can do.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {/* Add member */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-bold">Add a team member</h2>
        <p className="mt-1 text-sm text-slate-500">
          They must already have a SoundStage account. We&apos;ll notify them in-app.
        </p>
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-semibold text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "producer" | "editor" | "host")}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="producer">Producer</option>
              <option value="editor">Editor</option>
              <option value="host">Host</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add member"}
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-400">{ROLE_HELP[role]}</p>
      </div>

      {/* Roster */}
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-bold">Members</h2>
        {loading ? (
          <p className="mt-4 text-slate-500">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-4 text-slate-500">No members yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {m.email || m.userId.slice(0, 8)}
                    {m.isYou && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{ROLE_HELP[m.role]}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.role === "owner" ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      ⭐ Owner
                    </span>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="producer">Producer</option>
                        <option value="editor">Editor</option>
                        <option value="host">Host</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        className="rounded-lg border border-red-300 px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
