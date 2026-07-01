import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl p-8">
        <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-12 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Contact Us
          </p>

          <h1 className="mt-4 text-5xl font-bold">
            Let's talk about your podcast.
          </h1>

          <p className="mt-6 max-w-3xl text-xl text-white/80">
            Whether you're a solo creator, podcast network,
            media company, or educational institution,
            we'd love to hear from you.
          </p>
        </section>

        <section className="mt-10 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-3xl font-bold">
            Get In Touch
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">
                Name
              </label>

              <input
                className="mt-2 w-full rounded-lg border p-3"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">
                Email
              </label>

              <input
                className="mt-2 w-full rounded-lg border p-3"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-semibold">
              Message
            </label>

            <textarea
              rows={6}
              className="mt-2 w-full rounded-lg border p-3"
              placeholder="Tell us about your podcast..."
            />
          </div>

          <button className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white">
            Send Message
          </button>
        </section>

        <div className="mt-10">
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