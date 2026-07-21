import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function PublicNav() {
  return (
    <header className="mb-8 rounded-2xl border border-white bg-white/90 p-4 shadow-[0_12px_40px_rgba(53,40,90,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <BrandMark compact />

        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600 sm:gap-5" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-white shadow-lg shadow-violet-200"
          >
            Open SoundStage
          </Link>
        </nav>
      </div>
    </header>
  );
}
