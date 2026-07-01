import Link from "next/link";

export default function PublicNav() {
  return (
    <header className="mb-8 rounded-2xl bg-white p-4 shadow">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-slate-900">
          SoundStage Live
        </Link>

        <nav className="flex items-center gap-5 text-sm font-semibold text-slate-600">
          <Link href="/">Home</Link>
          <Link href="/browse">Browse Shows</Link>
          <Link href="/search">Search</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}