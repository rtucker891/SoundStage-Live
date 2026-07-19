"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import AppShell from "@/components/AppShell";
import { authHeaders } from "@/lib/authHeaders";
import {
  getShowSettings,
  updateShowSettings,
  type PodcastSettings,
} from "@/lib/api";

// Apple Podcasts official category + subcategory list. Using the exact strings
// Apple publishes so the feed's <itunes:category> is accepted at submission
// time. A category with subcategories maps to an array; "" is always the first
// choice ("No subcategory").
// Source: Apple Podcasts categories (help.apple.com / podcasters.apple.com).
const ITUNES_CATEGORY_MAP: Record<string, string[]> = {
  Arts: [
    "Books",
    "Design",
    "Fashion & Beauty",
    "Food",
    "Performing Arts",
    "Visual Arts",
  ],
  Business: [
    "Careers",
    "Entrepreneurship",
    "Investing",
    "Management",
    "Marketing",
    "Non-Profit",
  ],
  Comedy: ["Comedy Interviews", "Improv", "Stand-Up"],
  Education: ["Courses", "How To", "Language Learning", "Self-Improvement"],
  Fiction: ["Comedy Fiction", "Drama", "Science Fiction"],
  Government: [],
  History: [],
  "Health & Fitness": [
    "Alternative Health",
    "Fitness",
    "Medicine",
    "Mental Health",
    "Nutrition",
    "Sexuality",
  ],
  "Kids & Family": [
    "Education for Kids",
    "Parenting",
    "Pets & Animals",
    "Stories for Kids",
  ],
  Leisure: [
    "Animation & Manga",
    "Automotive",
    "Aviation",
    "Crafts",
    "Games",
    "Hobbies",
    "Home & Garden",
    "Video Games",
  ],
  Music: ["Music Commentary", "Music History", "Music Interviews"],
  News: [
    "Business News",
    "Daily News",
    "Entertainment News",
    "News Commentary",
    "Politics",
    "Sports News",
    "Tech News",
  ],
  "Religion & Spirituality": [
    "Buddhism",
    "Christianity",
    "Hinduism",
    "Islam",
    "Judaism",
    "Religion",
    "Spirituality",
  ],
  Science: [
    "Astronomy",
    "Chemistry",
    "Earth Sciences",
    "Life Sciences",
    "Mathematics",
    "Natural Sciences",
    "Nature",
    "Physics",
    "Social Sciences",
  ],
  "Society & Culture": [
    "Documentary",
    "Personal Journals",
    "Philosophy",
    "Places & Travel",
    "Relationships",
  ],
  Sports: [
    "Baseball",
    "Basketball",
    "Cricket",
    "Fantasy Sports",
    "Football",
    "Golf",
    "Hockey",
    "Rugby",
    "Running",
    "Soccer",
    "Swimming",
    "Tennis",
    "Volleyball",
    "Wilderness",
    "Wrestling",
  ],
  "TV & Film": [
    "After Shows",
    "Film History",
    "Film Interviews",
    "Film Reviews",
    "TV Reviews",
  ],
  Technology: [],
  "True Crime": [],
};

const ITUNES_CATEGORIES = Object.keys(ITUNES_CATEGORY_MAP);

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
  const [itunesSubcategory, setItunesSubcategory] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [language, setLanguage] = useState("en-us");

  // Cover-art upload state.
  const [coverArtUrl, setCoverArtUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [coverMessage, setCoverMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setItunesSubcategory(data.itunesSubcategory || "");
        setExplicit(data.explicit);
        setLanguage(data.language || "en-us");
        setCoverArtUrl(data.publishedCoverArtUrl || "");
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
        itunesSubcategory,
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

  // When the primary category changes, clear any subcategory that no longer
  // belongs to it so we never emit an invalid Apple category pairing.
  function handleCategoryChange(next: string) {
    setItunesCategory(next);
    const validSubs = ITUNES_CATEGORY_MAP[next] || [];
    if (!validSubs.includes(itunesSubcategory)) {
      setItunesSubcategory("");
    }
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setCoverMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/shows/${showId}/cover-art`, {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Upload failed.");
      }

      setCoverArtUrl(result.url);
      setCoverMessage("Cover art published. Your feed now uses this image.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCoverMessage(`Could not upload cover art: ${msg}`);
    } finally {
      setUploading(false);
      // Allow re-selecting the same file after an error.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const subcategoryOptions = ITUNES_CATEGORY_MAP[itunesCategory] || [];

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

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow">
            <h2 className="text-lg font-bold">Cover Art</h2>
            <p className={helpClass}>
              The square image shown next to your show in Apple Podcasts,
              Spotify, and other apps. Use a square JPG or PNG between 1400x1400
              and 3000x3000 pixels. This is uploaded to a permanent public
              address so directories can always reach it.
            </p>

            <div className="mt-4 flex items-center gap-5">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {coverArtUrl ? (
                  <Image
                    src={coverArtUrl}
                    alt="Show cover art"
                    width={112}
                    height={112}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-slate-400">
                    No cover art yet
                  </span>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  id="cover-art"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {uploading
                    ? "Uploading..."
                    : coverArtUrl
                      ? "Replace cover art"
                      : "Upload cover art"}
                </button>
                {coverMessage && (
                  <p
                    className={
                      coverMessage.startsWith("Could not")
                        ? "mt-2 text-xs font-medium text-red-600"
                        : "mt-2 text-xs font-medium text-green-600"
                    }
                  >
                    {coverMessage}
                  </p>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSave}
            className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow"
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
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={inputClass}
              >
                {ITUNES_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {subcategoryOptions.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="subcategory">
                  Subcategory
                </label>
                <p className={helpClass}>
                  A more specific home inside {itunesCategory}. Apple now
                  recommends one for many categories. Optional but improves
                  discovery.
                </p>
                <select
                  id="subcategory"
                  value={itunesSubcategory}
                  onChange={(e) => setItunesSubcategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No subcategory</option>
                  {subcategoryOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
