"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `block w-full rounded-lg px-4 py-2 text-left transition-colors ${
      pathname === path
        ? "bg-blue-600 font-semibold text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <aside className="w-64 bg-slate-950 p-6 text-white">
      <h1 className="text-2xl font-bold">SoundStage Live</h1>

      <p className="mt-2 text-sm text-slate-300">
        Create Live. From Anywhere.
      </p>

      <nav className="mt-8 flex flex-col gap-3 text-sm">
        <Link href="/" className={linkClass("/")}>
          Dashboard
        </Link>

        <Link href="/shows" className={linkClass("/shows")}>
          Shows
        </Link>

        <Link href="/episodes" className={linkClass("/episodes")}>
          Episodes
        </Link>

        <Link href="/studio" className={linkClass("/studio")}>
          Studio
        </Link>

        <Link href="/editor" className={linkClass("/editor")}>
          Editor
        </Link>

        <Link href="/publish" className={linkClass("/publish")}>
          Publish
        </Link>

        <Link href="/settings" className={linkClass("/settings")}>
          Settings
        </Link>
      </nav>
    </aside>
  );
}