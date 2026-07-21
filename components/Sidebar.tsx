"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { creatorNavigation, isCreatorNavItemActive } from "@/lib/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#0b0b14] px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center justify-between">
        <BrandMark href="/dashboard" compact />
        <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-violet-300">Creator</span>
      </div>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 text-sm lg:mt-8 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0" aria-label="Creator workspace">
        {creatorNavigation.map((section) => (
          <div className="flex shrink-0 gap-2 lg:flex-col" key={section.label}>
            <p className="hidden px-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 lg:block">{section.label}</p>
            <div className="flex gap-2 lg:flex-col lg:gap-1">
              {section.items.map((item) => {
                const active = isCreatorNavItemActive(pathname, item.href);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-950/50" : "text-slate-300 hover:bg-white/7 hover:text-white"}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm ${active ? "border-white/20 bg-white/15" : "border-white/8 bg-white/4 text-violet-300 group-hover:border-violet-400/30"}`}>{item.icon}</span>
                    <span>
                      <strong className="block text-xs font-bold">{item.label}</strong>
                      <small className={`hidden text-[9px] lg:block ${active ? "text-white/65" : "text-slate-500"}`}>{item.description}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 to-cyan-400/5 p-4 lg:block">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">One creator workspace</p>
        <p className="mt-2 text-xs font-semibold text-slate-200">Record, edit, publish, and grow without leaving SoundStage.</p>
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />All systems online</div>
      </div>
    </aside>
  );
}
