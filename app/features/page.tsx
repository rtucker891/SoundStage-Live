import Link from "next/link";

import PublicNav from "@/components/public/PublicNav";

const features = [
  { number: "01", title: "Record", copy: "Capture clean audio in the browser and keep every recording organized with its episode." },
  { number: "02", title: "Edit", copy: "Shape episodes with browser tools or open the Studio desktop app when you want a deeper editing workspace." },
  { number: "03", title: "Publish", copy: "Create listener pages, validated RSS feeds, embeds, and distribution-ready episodes from the same account." },
  { number: "04", title: "Monetize", copy: "Manage your plan, team, audience growth, and creator business without moving between products." },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#f4f5fb] text-slate-950">
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <PublicNav />
        <section className="overflow-hidden rounded-[2rem] bg-[#0b0b14] px-6 py-14 text-white shadow-2xl sm:px-12 lg:px-16">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">One connected platform</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">From first recording to growing revenue.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">SoundStage gives creators one login and one workspace for the complete life of an episode.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-bold shadow-lg shadow-violet-950">Open SoundStage</Link>
            <Link href="/pricing" className="rounded-xl border border-white/20 px-6 py-3 font-bold text-white">View pricing</Link>
          </div>
        </section>
        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="group rounded-3xl border border-violet-100 bg-white p-7 shadow-[0_14px_40px_rgba(53,40,90,0.07)] transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl">
              <span className="text-xs font-black tracking-[0.2em] text-violet-500">{feature.number}</span>
              <h2 className="mt-4 text-3xl font-black tracking-tight">{feature.title}</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">{feature.copy}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
