import Link from "next/link";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const podcasts = {
  "technology-today": {
    title: "Technology Today",
    image: "/images/technology-show.png",
    category: "Technology",
    description:
      "A podcast about AI, software, startups, digital tools, and the technology shaping the future.",
    episodes: [
      "How AI Is Changing Creative Work",
      "The Future of Software Development",
      "Why Every Creator Needs Better Tools",
    ],
  },
  "business-growth": {
    title: "Business Growth",
    image: "/images/business-show.png",
    category: "Business",
    description:
      "Practical conversations about leadership, marketing, entrepreneurship, and building a trusted brand.",
    episodes: [
      "Building a Brand That People Trust",
      "How Founders Grow an Audience",
      "Leadership Lessons for Modern Teams",
    ],
  },
  "health-wellness": {
    title: "Health & Wellness",
    image: "/images/health-show.png",
    category: "Health",
    description:
      "Conversations about healthy living, better habits, wellness, balance, and personal improvement.",
    episodes: [
      "Better Habits for Busy Creators",
      "Simple Wellness Routines",
      "How to Stay Balanced While Building",
    ],
  },
};

export default async function PodcastPage({ params }: Props) {
  const { id } = await params;
  const podcast = podcasts[id as keyof typeof podcasts];

  if (!podcast) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow">
          <h1 className="text-3xl font-black">Podcast Not Found</h1>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            Back Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl p-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm font-bold text-purple-600"
        >
          ← Back to Home
        </Link>

        <section className="grid gap-8 rounded-3xl bg-white p-8 shadow-xl lg:grid-cols-[320px_1fr]">
          <img
            src={podcast.image}
            alt={podcast.title}
            className="w-full rounded-3xl object-cover shadow"
          />

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-purple-600">
              {podcast.category} Podcast
            </p>

            <h1 className="mt-3 text-5xl font-black text-slate-900">
              {podcast.title}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              {podcast.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-3 font-bold text-white">
                Subscribe
              </button>

              <button className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-900">
                Share Show
              </button>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-3xl font-black text-slate-900">
            Episodes
          </h2>

          <div className="mt-6 space-y-4">
            {podcast.episodes.map((episode) => (
              <div
                key={episode}
                className="rounded-2xl bg-white p-6 shadow"
              >
                <h3 className="text-xl font-bold">{episode}</h3>

                <p className="mt-2 text-slate-600">
                  Listen to this episode from {podcast.title}.
                </p>

                <Link
                  href="/browse-episodes"
                  className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
                >
                  Listen Now
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}