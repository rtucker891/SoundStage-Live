"use client";

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import {
  getGuests,
  createGuest,
  updateGuest,
  deleteGuest,
  getGuestInvites,
  createGuestInvite,
  cancelGuestInvite,
  type Guest,
  type GuestInput,
  type GuestInvite,
} from "@/lib/api";

const EMPTY_FORM: GuestInput = {
  name: "",
  bio: "",
  photoUrl: "",
  websiteUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
};

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<GuestInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // #20 invites
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [invitingBusy, setInvitingBusy] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");

  async function load() {
    try {
      const [g, inv] = await Promise.all([getGuests(), getGuestInvites()]);
      setGuests(g);
      setInvites(inv);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvitingBusy(true);
    setInviteFeedback("");
    setLastInviteLink("");
    try {
      const { acceptUrl, emailSent } = await createGuestInvite({
        guestName: inviteName,
        guestEmail: inviteEmail,
        message: inviteMsg,
      });
      setLastInviteLink(acceptUrl);
      setInviteFeedback(
        emailSent
          ? `Invite created and emailed to ${inviteEmail.trim()}. You can also copy the link below to share it another way.`
          : "Invite created. Email sending isn't turned on yet — copy the link below and send it to your guest yourself."
      );
      setInviteName("");
      setInviteEmail("");
      setInviteMsg("");
      await load();
    } catch (err) {
      setInviteFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setInvitingBusy(false);
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await cancelGuestInvite(id);
      await load();
    } catch (err) {
      setInviteFeedback(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(g: Guest) {
    setEditingId(g.id);
    setForm({
      name: g.name,
      bio: g.bio || "",
      photoUrl: g.photoUrl || "",
      websiteUrl: g.websiteUrl || "",
      twitterUrl: g.twitterUrl || "",
      linkedinUrl: g.linkedinUrl || "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setMessage("Please enter the guest's name.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (editingId) {
        await updateGuest(editingId, form);
        setMessage("Guest updated.");
      } else {
        await createGuest(form);
        setMessage("Guest added.");
      }
      resetForm();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g: Guest) {
    if (!confirm(`Remove ${g.name}? This won't delete their past episodes.`)) {
      return;
    }
    try {
      await deleteGuest(g.id);
      if (editingId === g.id) resetForm();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Guests</h1>
        <p className="mt-2 text-slate-600">
          Build reusable guest profiles — bio, photo, and links — then attach
          them to episodes. Each guest gets a public profile page listing every
          episode they appear on.
        </p>

        {/* Add / edit form */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit guest" : "Add a guest"}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Name *
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Photo URL
              <input
                className={inputClass}
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://…/jane.jpg"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Bio
            <textarea
              className={inputClass}
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="A short description of who this guest is."
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Website
              <input
                className={inputClass}
                value={form.websiteUrl}
                onChange={(e) =>
                  setForm({ ...form, websiteUrl: e.target.value })
                }
                placeholder="https://…"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              X / Twitter
              <input
                className={inputClass}
                value={form.twitterUrl}
                onChange={(e) =>
                  setForm({ ...form, twitterUrl: e.target.value })
                }
                placeholder="https://x.com/…"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              LinkedIn
              <input
                className={inputClass}
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm({ ...form, linkedinUrl: e.target.value })
                }
                placeholder="https://linkedin.com/in/…"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-2.5 font-semibold text-white shadow disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Update guest"
                  : "Add guest"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700"
              >
                Cancel
              </button>
            )}
            {message && (
              <span className="text-sm text-slate-600">{message}</span>
            )}
          </div>
        </form>

        {/* #20 Invite a guest */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Invite a guest</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create an invitation link to share with a prospective guest. (Automatic
            email delivery is coming in a later phase; for now you&apos;ll get a
            link to send yourself.)
          </p>
          <form
            onSubmit={handleInvite}
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <label className="text-sm font-medium text-slate-700">
              Guest name *
              <input
                className={inputClass}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Guest email *
              <input
                className={inputClass}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700">
              Personal message (optional)
              <textarea
                className={inputClass}
                rows={2}
                value={inviteMsg}
                onChange={(e) => setInviteMsg(e.target.value)}
                placeholder="I'd love to have you on the show to talk about…"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={invitingBusy}
                className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {invitingBusy ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </form>
          {inviteFeedback && (
            <p className="mt-3 text-sm text-slate-600">{inviteFeedback}</p>
          )}
          {lastInviteLink && (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={lastInviteLink}
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(lastInviteLink)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Copy
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Sent invites
              </h3>
              <ul className="mt-3 space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{inv.guestName}</span>{" "}
                      <span className="text-slate-500">({inv.guestEmail})</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          inv.status === "accepted"
                            ? "bg-emerald-100 text-emerald-700"
                            : inv.status === "declined"
                              ? "bg-rose-100 text-rose-700"
                              : inv.status === "cancelled"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.status === "pending" && (
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          className="text-xs font-semibold text-slate-500"
                        >
                          Cancel
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Guest list */}
        <div className="mt-8">
          {loading ? (
            <p className="text-slate-500">Loading guests…</p>
          ) : guests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No guests yet. Add your first guest above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {guests.map((g) => (
                <li
                  key={g.id}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.photoUrl || "/default-cover.png"}
                    alt={g.name}
                    className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{g.name}</h3>
                    {g.bio && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {g.bio}
                      </p>
                    )}
                    <div className="mt-3 flex gap-3 text-sm">
                      <a
                        href={`/guest/${g.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-purple-600"
                      >
                        View profile →
                      </a>
                      <button
                        onClick={() => startEdit(g)}
                        className="font-semibold text-slate-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="font-semibold text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
