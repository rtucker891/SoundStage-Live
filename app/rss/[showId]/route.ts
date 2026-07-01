import { createClient } from "@supabase/supabase-js";

type Props = {
  params: Promise<{
    showId: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: Props
) {
  const { showId } = await params;

  const { data: show } = await supabase
    .from("shows")
    .select("id, title, description, cover_art_url")
    .eq("id", showId)
    .single();

  if (!show) {
    return new Response("Show not found", {
      status: 404,
    });
  }

  const { data: episodes = [] } = await supabase
    .from("episodes")
    .select("id, title, guest, created_at")
    .eq("show_id", showId)
    .eq("status", "Published")
    .order("created_at", { ascending: false });

  const baseUrl = new URL(request.url).origin;

  const items = episodes
    .map(
      (episode) => `
        <item>
          <title>${episode.title}</title>
          <description>Guest: ${
            episode.guest || "No guest listed"
          }</description>
          <link>${baseUrl}/listen/${episode.id}</link>
          <guid>${episode.id}</guid>
          <pubDate>${new Date(
            episode.created_at
          ).toUTCString()}</pubDate>
        </item>
      `
    )
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${show.title}</title>
    <description>${show.description || "Podcast show"}</description>
    <link>${baseUrl}/public-shows/${show.id}</link>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}