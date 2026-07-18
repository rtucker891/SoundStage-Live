"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `block w-full rounded-xl px-4 py-3 text-left transition-all ${
      pathname === path
        ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 font-semibold text-white shadow-lg"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <aside className="flex w-72 flex-col bg-slate-950 p-6 text-white">
      <Link href="/" className="block">
        <Image
          src="/logo-dark.png"
          alt="SoundStage Live"
          width={1756}
          height={664}
          priority
          className="h-auto w-full"
        />
      </Link>

      <nav className="mt-8 flex flex-col gap-3 text-sm">
        <Link href="/" className={linkClass("/")}>
          🏠 Dashboard
        </Link>

        <Link href="/shows" className={linkClass("/shows")}>
          🎙 Shows
        </Link>

        <Link href="/episodes" className={linkClass("/episodes")}>
          📺 Episodes
        </Link>

        <Link href="/guests" className={linkClass("/guests")}>
          👥 Guests
        </Link>

        <Link href="/studio" className={linkClass("/studio")}>
          🎚 Studio
        </Link>

        <Link href="/editor" className={linkClass("/editor")}>
          ✍ Editor
        </Link>

        <Link href="/publish" className={linkClass("/publish")}>
          🚀 Publish
        </Link>

        <Link href="/settings" className={linkClass("/settings")}>
          ⚙ Settings
        </Link>
      </nav>

      <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Platform Status
        </p>

        <p className="mt-2 font-semibold text-emerald-400">
          ● Online
        </p>
      </div>
    </aside>
  );
}