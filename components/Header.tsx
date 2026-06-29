"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email || "Unknown User");
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

        <p className="text-sm text-slate-500">
          {email}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search shows or episodes..."
          className="w-72 rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-blue-500"
        />

        <button className="rounded-lg border border-slate-200 px-4 py-2">
          Notifications
        </button>

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