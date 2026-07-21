import Link from "next/link";

export default function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3" aria-label="SoundStage home">
      <span className={`${compact ? "h-10 w-10 text-lg" : "h-12 w-12 text-xl"} relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-600 to-fuchsia-500 font-black text-white shadow-lg shadow-violet-500/25`}>
        S
        <span className="absolute inset-x-2 bottom-1.5 h-px bg-white/70 shadow-[0_0_8px_white]" />
      </span>
      <span className="min-w-0">
        <span className={`${compact ? "text-xl" : "text-2xl"} block font-black tracking-tight text-current`}>SoundStage</span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">Create · Publish · Grow</span>
      </span>
    </Link>
  );
}
