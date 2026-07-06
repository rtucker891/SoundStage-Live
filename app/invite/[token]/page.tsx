"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type InviteView = {
  guestName: string;
  message: string | null;
  status: string;
  episodeTitle: string | null;
};

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;

  const [invite, setInvite] = useState<InviteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invites/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invite not found.");
        setInvite(data);
        if (data.status !== "pending") setResult(data.status);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    setResponding(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not respond.");
      setResult(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResponding(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 text-center text-white">
          <h1 className="text-2xl font-bold">SoundStage Live</h1>
          <p className="mt-1 text-sm text-white/80">Guest invitation</p>
        </div>

        {loading ? (
          <p className="mt-6 text-center text-slate-500">Loading invite…</p>
        ) : error ? (
          <p className="mt-6 text-center text-rose-600">{error}</p>
        ) : !invite ? (
          <p className="mt-6 text-center text-slate-500">Invite not found.</p>
        ) : result ? (
          <div className="mt-6 text-center">
            <p className="text-lg font-semibold text-slate-900">
              {result === "accepted"
                ? "🎉 You've accepted this invitation."
                : result === "declined"
                  ? "You've declined this invitation."
                  : `This invite is ${result}.`}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              The host has been notified. You can close this page.
            </p>
          </div>
        ) : (
          <div className="mt-6 text-center">
            <p className="text-lg text-slate-900">
              Hi <span className="font-semibold">{invite.guestName}</span>,
            </p>
            <p className="mt-2 text-slate-600">
              You&apos;ve been invited to appear as a guest
              {invite.episodeTitle ? (
                <>
                  {" "}
                  on <span className="font-semibold">{invite.episodeTitle}</span>
                </>
              ) : null}
              .
            </p>
            {invite.message && (
              <blockquote className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-sm italic text-slate-700">
                “{invite.message}”
              </blockquote>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => respond("accept")}
                disabled={responding}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white shadow disabled:opacity-60"
              >
                {responding ? "…" : "Accept"}
              </button>
              <button
                onClick={() => respond("decline")}
                disabled={responding}
                className="flex-1 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
