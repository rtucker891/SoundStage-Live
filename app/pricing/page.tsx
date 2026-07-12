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

        <section className="mt-10 grid items-start gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Free</h2>
            <p className="mt-2 text-slate-600">For getting your first show off the ground.</p>
            <p className="mt-6 text-4xl font-bold">
              $0<span className="text-lg font-medium text-slate-500">/mo</span>
            </p>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ 1 show, up to 5 published episodes</li>
              <li>✓ Browser recording &amp; storage</li>
              <li>✓ Publish to Apple, Spotify &amp; more</li>
              <li>✓ AI toolkit (transcripts &amp; show notes)</li>
              <li>✓ Basic analytics</li>
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-indigo-600">Most Popular</p>
            <h2 className="mt-2 text-2xl font-bold">Creator</h2>
            <p className="mt-2 text-slate-600">For serious creators ready to grow.</p>
            <p className="mt-6 text-4xl font-bold">
              $12<span className="text-lg font-medium text-slate-500">/mo</span>
            </p>
            <p className="text-sm text-slate-500">or $120/yr — save 2 months</p>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ Everything in Free</li>
              <li>✓ Up to 3 shows, unlimited episodes</li>
              <li>✓ Live streaming</li>
              <li>✓ Full analytics</li>
              <li>✓ 3 team seats</li>
              <li>✓ Import your existing show (RSS)</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Studio</h2>
            <p className="mt-2 text-slate-600">For power creators, teams, and networks.</p>
            <p className="mt-6 text-4xl font-bold">
              $29<span className="text-lg font-medium text-slate-500">/mo</span>
            </p>
            <p className="text-sm text-slate-500">or $290/yr — save 2 months</p>

            <div className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-px">
              <div className="rounded-[11px] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  New · Studio exclusive
                </p>
                <p className="mt-1 font-bold text-slate-900">AI Episode Studio</p>
                <p className="mt-1 text-sm text-slate-600">
                  Finish recording, click once, and get a publish-ready episode —
                  transcript, title, show notes, chapters, dead-air trim &amp; a
                  shareable audiogram. Your live show with a producer built in.
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-slate-600">
              <li>✓ Everything in Creator</li>
              <li>✓ Unlimited shows &amp; episodes</li>
              <li>✓ Advanced analytics + export</li>
              <li>✓ 15 team seats</li>
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