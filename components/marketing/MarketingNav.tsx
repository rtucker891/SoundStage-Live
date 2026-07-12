import Link from "next/link";
import SoundStageLogo from "@/components/public/SoundStageLogo";

export default function MarketingNav() {
  return <header className="relative z-50 px-5 pt-5 sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-white/[.055] px-5 py-3 text-white backdrop-blur-xl">
    <SoundStageLogo compact />
    <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-white/68 lg:flex">
      <details className="nav-menu relative"><summary>Features <span>⌄</span></summary><div className="nav-popover"><Link href="/#features">AI production</Link><Link href="/#how-it-works">Recording & publishing</Link><Link href="/analytics">Analytics</Link></div></details>
      <details className="nav-menu relative"><summary>Resources <span>⌄</span></summary><div className="nav-popover"><Link href="/coming-soon/blog">Blog</Link><Link href="/about">About us</Link><Link href="/contact">Help center</Link></div></details>
      <Link href="/studio">Live</Link><Link href="/browse">Podcasts</Link><Link href="/#how-it-works">Switch</Link><Link href="/contact">Help</Link><Link href="/pricing">Pricing</Link>
    </nav>
    <div className="flex items-center gap-3"><Link href="/dashboard" className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#171717] transition hover:bg-[#ffb7d1] sm:px-5">Enter studio</Link></div>
  </div></header>;
}
