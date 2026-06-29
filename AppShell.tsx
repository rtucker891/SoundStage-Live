"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCheckingAuth(false);
    }

    checkUser();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Checking sign in...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex">
        <Sidebar />

        <main className="min-h-screen flex-1 p-6">
          <Header />
          {children}
        </main>
      </div>
    </div>
  );
}