<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow">
  <h2 className="text-lg font-bold text-slate-900">
    Episode Progress
  </h2>

  <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        ✓ Recording
      </p>
    </div>

    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        {transcript ? "✓ Transcript" : "○ Transcript"}
      </p>
    </div>

    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        {showNote ? "✓ Show Notes" : "○ Show Notes"}
      </p>
    </div>

    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        {episodeDescription ? "✓ Description" : "○ Description"}
      </p>
    </div>

    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        {publishPackage ? "✓ Publish" : "○ Publish"}
      </p>
    </div>

    <div className="rounded-xl bg-green-50 p-3 text-center">
      <p className="text-sm font-semibold text-green-700">
        {coverArtUrl ? "✓ Cover Art" : "○ Cover Art"}
      </p>
    </div>
  </div>
</div>