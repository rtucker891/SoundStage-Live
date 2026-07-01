import Link from "next/link";
import PublicNav from "@/components/public/PublicNav";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-100">
  <div className="mx-auto max-w-6xl p-8">
    <PublicNav />
     
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Pricing
          </p>

          <h1 className="mt-3 text-5xl font-bold">
            Plans for creators, teams, and studios
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Start simple, then grow into advanced production and distribution tools.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Creator Lite</h2>
            <p className="mt-2 text-slate-600">For solo podcasters getting started.</p>
            <p className="mt-6 text-4xl font-bold">$19/mo</p>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ Create shows</li>
              <li>✓ Create episodes</li>
              <li>✓ Browser recording</li>
              <li>✓ Public episode pages</li>
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-indigo-600">Most Popular</p>
            <h2 className="mt-2 text-2xl font-bold">Creator Pro</h2>
            <p className="mt-2 text-slate-600">For serious creators and small teams.</p>
            <p className="mt-6 text-4xl font-bold">$49/mo</p>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ Everything in Lite</li>
              <li>✓ AI transcripts</li>
              <li>✓ AI show notes</li>
              <li>✓ Cover art uploads</li>
              <li>✓ Public show pages</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Studio</h2>
            <p className="mt-2 text-slate-600">For agencies, networks, and media teams.</p>
            <p className="mt-6 text-4xl font-bold">Custom</p>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ Multi-show management</li>
              <li>✓ Team workflows</li>
              <li>✓ Advanced publishing</li>
              <li>✓ Future RSS distribution</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </section>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Back to Home
          </Link>
        
      
           </div>
      </div>
    </main>
  );
}