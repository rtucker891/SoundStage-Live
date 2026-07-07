"use client";

/**
 * Audit trail page (#58) — /shows/[id]/audit
 *
 * Shows an immutable, newest-first list of sensitive actions on this show:
 * who did what, to what, and when. Any member of the show can view it (the
 * database enforces that via RLS). Entries can never be edited or deleted.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { getAuditLog, type AuditEntry } from "@/lib/api";

/** Turn an action code + metadata into a friendly sentence + an icon. */
function describe(entry: AuditEntry): { icon: string; text: string } {
  const who = entry.actorEmail || "Someone";
  const m = entry.metadata || {};
  switch (entry.action) {
    case "show.deleted":
      return { icon: "🗑️", text: `${who} deleted this show.` };
    case "show.imported":
      return {
        icon: "⬇️",
        text: `${who} imported this show${
          m.imported ? ` (${m.imported} episode${m.imported === 1 ? "" : "s"})` : ""
        }.`,
      };
    case "member.added":
      return {
        icon: "➕",
        text: `${who} added ${entry.target ?? "a member"}${
          m.role ? ` as ${m.role}` : ""
        }.`,
      };
    case "member.removed":
      return {
        icon: "➖",
        text: m.self
          ? `${who} left the show.`
          : `${who} removed ${entry.target ?? "a member"}.`,
      };
    case "member.role_changed":
      return {
        icon: "🔁",
        text: `${who} changed ${entry.target ?? "a member"}'s role${
          m.from && m.to ? ` from ${m.from} to ${m.to}` : ""
        }.`,
      };
    case "episode.published":
      return { icon: "📢", text: `${who} published “${entry.target ?? "an episode"}”.` };
    case "episode.unpublished":
      return { icon: "📥", text: `${who} unpublished “${entry.target ?? "an episode"}”.` };
    default:
      return { icon: "•", text: `${who}: ${entry.action}` };
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AuditPage() {
  const params = useParams();
  const showId = String(params?.id || "");

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await getAuditLog(showId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    if (showId) load();
  }, [showId, load]);

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/shows" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Back to shows
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Activity log</h1>
        <p className="mt-2 text-slate-600">
          A permanent, tamper-proof record of sensitive actions on this show —
          who did what, and when. Entries can&apos;t be edited or deleted.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading activity…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No activity recorded yet. Actions like publishing an episode, adding a
          team member, or changing a role will appear here.
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const { icon, text } = describe(e);
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
                <div className="flex-1">
                  <p className="text-slate-800">{text}</p>
                  <p className="mt-0.5 text-xs text-slate-400" title={new Date(e.createdAt).toLocaleString()}>
                    {timeAgo(e.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </AppShell>
  );
}
