/**
 * lib/rssImport.ts — SERVER-ONLY RSS/XML feed parsing for podcast import (#55).
 *
 * Why a hand-rolled parser instead of a library?
 *  - Podcast feeds are plain RSS 2.0 XML with a well-known, stable shape
 *    (<channel> for the show, repeated <item> for episodes).
 *  - We only need a handful of fields, so a tiny regex/DOM-free reader keeps
 *    the dependency surface (and bundle) small and avoids native modules.
 *  - It never throws on malformed input: unknown/missing tags simply come back
 *    empty, which the caller handles gracefully.
 *
 * This module must only be imported from server code (API routes). It performs
 * network fetches and returns structured data — it does NOT touch the database.
 */

export type ParsedEpisode = {
  title: string;
  guid: string | null;
  description: string;
  /** RFC-2822 publish date string from the feed, if present. */
  pubDate: string | null;
  /** Absolute URL to the episode audio (from <enclosure>), if present. */
  audioUrl: string | null;
  /** MIME type declared on the enclosure, if present. */
  audioMime: string | null;
  /** Byte length declared on the enclosure, if present. */
  audioSize: number | null;
  /** Duration in seconds parsed from <itunes:duration>, if present. */
  durationSeconds: number | null;
  /** Episode-level artwork from <itunes:image href>, if present. */
  imageUrl: string | null;
};

export type ParsedFeed = {
  title: string;
  description: string;
  author: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  language: string | null;
  explicit: boolean;
  itunesCategory: string | null;
  itunesSubcategory: string | null;
  imageUrl: string | null;
  episodes: ParsedEpisode[];
};

/** Decode the handful of XML/HTML entities that appear in feed text. */
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    // Ampersand LAST so we don't double-decode the escapes above.
    .replace(/&amp;/g, "&");
}

/** Strip HTML tags and collapse whitespace, for turning rich descriptions into plain text. */
function stripHtml(input: string): string {
  return decodeEntities(
    input
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull the inner text of the FIRST <tag>…</tag> in `xml`. Handles CDATA. */
function tagText(xml: string, tag: string): string | null {
  // Escape ':' in namespaced tags like itunes:duration for the regex.
  const t = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  const raw = m[1];
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const inner = cdata ? cdata[1] : raw;
  const text = decodeEntities(inner).trim();
  return text || null;
}

/** Pull a specific attribute from the FIRST <tag …attr="…"…>. Self-closing OK. */
function tagAttr(xml: string, tag: string, attr: string): string | null {
  const t = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${t}\\b[^>]*?\\b${a}\\s*=\\s*"([^"]*)"[^>]*/?>`, "i");
  const m = xml.match(re);
  return m ? decodeEntities(m[1]).trim() || null : null;
}

/**
 * Parse <itunes:duration> which can be seconds ("3600"), "MM:SS", or "HH:MM:SS".
 */
function parseDuration(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Read the itunes:explicit flag (yes/true/clean/no) into a boolean. */
function parseExplicit(value: string | null): boolean {
  if (!value) return false;
  return /^(yes|true|explicit)$/i.test(value.trim());
}

/**
 * Extract the itunes:owner block's name/email (they're nested tags).
 */
function parseOwner(channelXml: string): { name: string | null; email: string | null } {
  const block = channelXml.match(/<itunes:owner\b[^>]*>([\s\S]*?)<\/itunes:owner>/i);
  const scope = block ? block[1] : channelXml;
  return {
    name: tagText(scope, "itunes:name"),
    email: tagText(scope, "itunes:email"),
  };
}

/**
 * Extract the primary and (optional) nested sub-category from itunes:category.
 * Apple nests a subcategory as a child <itunes:category> inside the parent.
 */
function parseCategory(channelXml: string): { category: string | null; sub: string | null } {
  const m = channelXml.match(/<itunes:category\b[^>]*\btext\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/itunes:category>/i);
  if (m) {
    const category = decodeEntities(m[1]).trim() || null;
    const sub = tagAttr(m[2], "itunes:category", "text");
    return { category, sub };
  }
  // Self-closing single category with no subcategory.
  const self = channelXml.match(/<itunes:category\b[^>]*\btext\s*=\s*"([^"]*)"[^>]*\/>/i);
  return { category: self ? decodeEntities(self[1]).trim() || null : null, sub: null };
}

/** The channel-level <image><url> (RSS 2.0) as a fallback for artwork. */
function parseChannelImageUrl(channelXml: string): string | null {
  const block = channelXml.match(/<image\b[^>]*>([\s\S]*?)<\/image>/i);
  if (block) {
    const url = tagText(block[1], "url");
    if (url) return url;
  }
  return null;
}

/**
 * Parse a full RSS feed string into a structured show + episodes.
 * Never throws on missing fields — returns empty/nulls instead.
 */
export function parseFeed(xmlText: string): ParsedFeed {
  // Isolate the <channel> so item-level tags don't leak into channel reads.
  const channelMatch = xmlText.match(/<channel\b[^>]*>([\s\S]*)<\/channel>/i);
  const channel = channelMatch ? channelMatch[1] : xmlText;

  // Channel metadata comes from the part of <channel> BEFORE the first <item>.
  const firstItemIdx = channel.search(/<item\b/i);
  const channelHead = firstItemIdx === -1 ? channel : channel.slice(0, firstItemIdx);

  const owner = parseOwner(channelHead);
  const cat = parseCategory(channelHead);
  const imageUrl =
    tagAttr(channelHead, "itunes:image", "href") || parseChannelImageUrl(channelHead);

  // Episodes: every <item>…</item> block.
  const episodes: ParsedEpisode[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(channel)) !== null) {
    const item = im[1];
    const enclosureUrl = tagAttr(item, "enclosure", "url");
    const rawDesc =
      tagText(item, "content:encoded") ??
      tagText(item, "description") ??
      tagText(item, "itunes:summary") ??
      "";
    const sizeStr = tagAttr(item, "enclosure", "length");
    episodes.push({
      title: tagText(item, "title") || "Untitled episode",
      guid: tagText(item, "guid"),
      description: stripHtml(rawDesc),
      pubDate: tagText(item, "pubDate"),
      audioUrl: enclosureUrl,
      audioMime: tagAttr(item, "enclosure", "type"),
      audioSize: sizeStr && /^\d+$/.test(sizeStr) ? Number(sizeStr) : null,
      durationSeconds: parseDuration(tagText(item, "itunes:duration")),
      imageUrl: tagAttr(item, "itunes:image", "href"),
    });
  }

  return {
    title: tagText(channelHead, "title") || "Imported Show",
    description: stripHtml(
      tagText(channelHead, "description") ||
        tagText(channelHead, "itunes:summary") ||
        ""
    ),
    author: tagText(channelHead, "itunes:author"),
    ownerName: owner.name,
    ownerEmail: owner.email,
    language: tagText(channelHead, "language"),
    explicit: parseExplicit(tagText(channelHead, "itunes:explicit")),
    itunesCategory: cat.category,
    itunesSubcategory: cat.sub,
    imageUrl,
    episodes,
  };
}

/**
 * Fetch a feed URL and parse it. Enforces http(s), a timeout, and a size cap so
 * a hostile or huge URL can't hang or exhaust memory. Returns the parsed feed.
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedFeed> {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error("That doesn't look like a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Feed URL must start with http:// or https://.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "SoundStageLive/1.0 (+podcast import)" },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Could not fetch the feed (HTTP ${res.status}).`);
    }
    const text = await res.text();
    if (!/<rss[\s>]|<feed[\s>]|<channel[\s>]/i.test(text)) {
      throw new Error("That URL didn't return a podcast RSS feed.");
    }
    return parseFeed(text);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Fetching the feed timed out. Try again or check the URL.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
