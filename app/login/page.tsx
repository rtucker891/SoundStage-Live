"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. Check your email if confirmation is required.");
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold">SoundStage Live</h1>
        <p className="mt-2 text-slate-600">
          Sign in to manage your podcast workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-200 p-3"
            required
          />

         <div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(event) => setPassword(event.target.value)}
    placeholder="Password"
    className="w-full rounded-lg border border-slate-200 p-3 pr-24"
    required
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-purple-700"
  >
    {showPassword ? "Hide" : "Show"}
  </button>
</div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-3 font-semibold text-white"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          onClick={() =>
            setMode(mode === "signin" ? "signup" : "signin")
          }
          className="mt-4 text-sm font-semibold text-purple-700"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>

        {message && (
          <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}