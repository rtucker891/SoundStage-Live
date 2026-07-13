import Link from "next/link";
import PublicNav from "@/components/public/PublicNav";
import PricingPlans from "@/components/pricing/PricingPlans";

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

        <PricingPlans />

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
