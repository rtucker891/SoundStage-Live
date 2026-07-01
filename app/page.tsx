<section className="mt-12">
  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
    Explore Categories
  </p>

  <h2 className="mt-2 text-3xl font-bold">
    Find content you love
  </h2>

  <div className="mt-6 grid gap-4 md:grid-cols-4">
    <Link
      href="/search?q=technology"
      className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
    >
      <h3 className="font-bold">Technology</h3>
    </Link>

    <Link
      href="/search?q=science"
      className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
    >
      <h3 className="font-bold">Science</h3>
    </Link>

    <Link
      href="/search?q=business"
      className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
    >
      <h3 className="font-bold">Business</h3>
    </Link>

    <Link
      href="/search?q=education"
      className="rounded-2xl bg-white p-6 text-center shadow hover:shadow-lg"
    >
      <h3 className="font-bold">Education</h3>
    </Link>
  </div>
</section>