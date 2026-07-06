"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import {
  getShowSettings,
  updateShowSettings,
  type PodcastSettings,
} from "@/lib/api";

// Apple Podcasts primary categories. Using the exact official strings so the
// feed's <itunes:category> is accepted at submission time.
const ITUNES_CATEGORIES = [
  "Arts",
  "Business",
  "Comedy",
  "Education",
  "Fiction",
  "Government",
  "History",
  "Health & Fitness",
  "Kids & Family",
  "Leisure",
  "Music",
  "News",
  "Religion & Spirituality",
  "Science",
  "Society & Culture",
  "Sports",
  "Technology",
  "True Crime",
  "TV & Film",
];

// Common podcast feed languages (RFC 5646 codes). Kept short; users can grow it.
const LANGUAGES = [
  { code: "en-us", label: "English (US)" },
  { code: "en-gb", label: "English (UK)" },
  { code: "pt-br", label: "Portuguese (Brazil)" },
  { code: "pt-pt", label: "Portuguese (Portugal)" },
  { code: "es-es", label: "Spanish (Spain)" },
  { code: "es-mx", label: "Spanish (Mexico)" },
  { code: "fr-fr", label: "French" },
  { code: "de-de", label: "German" },
];

export default function PodcastSettingsPage() {
  const params = useParams();
  const showId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<PodcastSettings | null>(null);

  // Editable form fields.
  const [author, setAuthor] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [itunesCategory, setItunesCategory] = useState("Society & Culture");
  const [explicit, setExplicit] = useState(false);
  const [language, setLanguage] = useState("en-us");

  useEffect(() => {
    async function load() {
      try {
        const data = await getShowSettings(showId);
        if (!data) {
          setNotFound(true);
          return;
        }
        setSettings(data);
        setAuthor(data.author);
        setOwnerName(data.ownerName);
        setOwnerEmail(data.ownerEmail);
        setItunesCategory(data.itunesCategory || "Society & Culture");
        setExplicit(data.explicit);
        setLanguage(data.language || "en-us");
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showId]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    // Light validation: owner email is required by Apple for verification.
    if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setMessage("Please enter a valid owner email address.");
      setSaving(false);
      return;
    }

    try {
      await updateShowSettings(showId, {
        author,
        ownerName,
        ownerEmail,
        itunesCategory,
        explicit,
        language,
      });
      setMessage("Saved. Your feed now reflects these details.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(`Could not save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-semibold text-slate-800";
  const helpClass = "mt-1 text-xs text-slate-500";
  const inputClass =
    "mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-slate-900 focus:outline-none";

  return (
    <AppShell>
      {loading ? (
        <p className="text-slate-500">Loading settings...</p>
      ) : notFound ? (
        <p className="text-red-500">Show not found.</p>
      ) : (
        <div className="max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Podcast Settings</h1>
              <p className="mt-2 text-slate-600">
                {settings?.title} — details required to submit your show to
                Apple Podcasts, Spotify, and other directories.
              </p>
            </div>
            <Link
              href={`/shows/${showId}`}
              className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Show
            </Link>
          </div>

          <form
            onSubmit={handleSave}
            className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow"
          >
            <div>
              <label className={labelClass} htmlFor="author">
                Author
              </label>
              <p className={helpClass}>
                The name shown under your show — usually you or your brand.
              </p>
              <input
                id="author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={settings?.title || "Your name or brand"}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="ownerName">
                Owner Name
              </label>
              <p className={helpClass}>
                The contact person who owns this feed. Not shown publicly.
              </p>
              <input
                id="ownerName"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Feed owner's name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="ownerEmail">
                Owner Email <span className="text-red-500">*</span>
              </label>
              <p className={helpClass}>
                Required. Apple sends a verification email here when you submit
                your show. Use an address you can access.
              </p>
              <input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="category">
                Category
              </label>
              <p className={helpClass}>
                Where your show is listed in the directory.
              </p>
              <select
                id="category"
                value={itunesCategory}
                onChange={(e) => setItunesCategory(e.target.value)}
                className={inputClass}
              >
                {ITUNES_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="language">
                Language
              </label>
              <p className={helpClass}>The primary language of your show.</p>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={inputClass}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
              <input
                id="explicit"
                type="checkbox"
                checked={explicit}
                onChange={(e) => setExplicit(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <label htmlFor="explicit" className="text-sm text-slate-800">
                <span className="font-semibold">Explicit content</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Check this if your show contains explicit language or mature
                  themes. Directories require an accurate rating.
                </span>
              </label>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <a
                href={`/rss/${showId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-slate-700 underline"
              >
                View RSS feed
              </a>
            </div>

            {message && (
              <p
                className={
                  message.startsWith("Could not") ||
                  message.startsWith("Please")
                    ? "text-sm font-medium text-red-600"
                    : "text-sm font-medium text-green-600"
                }
              >
                {message}
              </p>
            )}
          </form>
        </div>
      )}
    </AppShell>
  );
}
