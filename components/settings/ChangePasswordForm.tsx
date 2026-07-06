"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("The new passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      // Find out who is logged in so we can verify the current password.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setError("You are not signed in. Please sign in again.");
        return;
      }

      // Verify the current password by attempting a sign-in with it.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        setError("Current password is incorrect.");
        return;
      }

      // Current password checks out — set the new one.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold">Change Password</h2>
      <p className="mt-2 text-slate-600">
        Update the password you use to sign in.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-600">
            Current password
          </label>
          <input
            type={show ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-3"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-600">
            New password
          </label>
          <input
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-3"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-600">
            Confirm new password
          </label>
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-3"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Show passwords
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Update Password"}
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
