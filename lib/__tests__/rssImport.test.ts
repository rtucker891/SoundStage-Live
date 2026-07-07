import { describe, it, expect } from "vitest";
import { parseFeed } from "../rssImport";

const feed = (channelInner: string, items = "") => `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    ${channelInner}
    ${items}
  </channel>
</rss>`;

describe("parseFeed — channel metadata", () => {
  it("parses core show fields", () => {
    const xml = feed(`
      <title>My Great Show</title>
      <description>All about widgets.</description>
      <language>en-us</language>
      <itunes:author>Jane Host</itunes:author>
      <itunes:explicit>yes</itunes:explicit>
    `);
    const f = parseFeed(xml);
    expect(f.title).toBe("My Great Show");
    expect(f.description).toBe("All about widgets.");
    expect(f.language).toBe("en-us");
    expect(f.author).toBe("Jane Host");
    expect(f.explicit).toBe(true);
  });

  it("decodes XML entities in text", () => {
    const xml = feed(`<title>Rock &amp; Roll &#8212; Live</title><description>a &lt;b&gt; c</description>`);
    const f = parseFeed(xml);
    expect(f.title).toBe("Rock & Roll — Live");
    // description is run through stripHtml which decodes and strips tags
    expect(f.description).toBe("a  c".replace(/\s+/g, " ").trim());
  });

  it("reads CDATA-wrapped content", () => {
    const xml = feed(`<title><![CDATA[Cash & Data]]></title><description><![CDATA[<p>Hello <b>world</b></p>]]></description>`);
    const f = parseFeed(xml);
    expect(f.title).toBe("Cash & Data");
    expect(f.description).toBe("Hello world");
  });

  it("parses a nested itunes:category with a subcategory", () => {
    const xml = feed(`
      <title>Cat Show</title>
      <itunes:category text="Technology">
        <itunes:category text="Tech News"/>
      </itunes:category>
    `);
    const f = parseFeed(xml);
    expect(f.itunesCategory).toBe("Technology");
    expect(f.itunesSubcategory).toBe("Tech News");
  });

  it("parses a self-closing itunes:category with no subcategory", () => {
    const xml = feed(`<title>Cat Show</title><itunes:category text="Comedy"/>`);
    const f = parseFeed(xml);
    expect(f.itunesCategory).toBe("Comedy");
    expect(f.itunesSubcategory).toBeNull();
  });

  it("extracts the itunes:owner name/email block", () => {
    const xml = feed(`
      <title>Owned</title>
      <itunes:owner>
        <itunes:name>Owner Person</itunes:name>
        <itunes:email>owner@example.com</itunes:email>
      </itunes:owner>
    `);
    const f = parseFeed(xml);
    expect(f.ownerName).toBe("Owner Person");
    expect(f.ownerEmail).toBe("owner@example.com");
  });

  it("prefers itunes:image href, falling back to channel <image><url>", () => {
    const withItunes = feed(`<title>A</title><itunes:image href="https://img/itunes.jpg"/><image><url>https://img/rss.jpg</url></image>`);
    expect(parseFeed(withItunes).imageUrl).toBe("https://img/itunes.jpg");

    const rssOnly = feed(`<title>A</title><image><url>https://img/rss.jpg</url></image>`);
    expect(parseFeed(rssOnly).imageUrl).toBe("https://img/rss.jpg");
  });

  it("falls back to defaults when fields are missing", () => {
    const f = parseFeed(feed(`<language>en</language>`));
    expect(f.title).toBe("Imported Show");
    expect(f.description).toBe("");
    expect(f.author).toBeNull();
    expect(f.ownerName).toBeNull();
    expect(f.explicit).toBe(false);
    expect(f.episodes).toEqual([]);
  });

  it("never throws on malformed / non-feed input", () => {
    expect(() => parseFeed("garbage not xml")).not.toThrow();
    expect(parseFeed("garbage not xml").episodes).toEqual([]);
  });
});

describe("parseFeed — episodes", () => {
  const item = (inner: string) => `<item>${inner}</item>`;

  it("parses multiple items with enclosure + guid + pubDate", () => {
    const xml = feed(
      `<title>Show</title>`,
      item(`
        <title>Ep 1</title>
        <guid>guid-1</guid>
        <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
        <enclosure url="https://audio/1.mp3" type="audio/mpeg" length="12345"/>
        <itunes:duration>3600</itunes:duration>
      `) +
        item(`
        <title>Ep 2</title>
        <enclosure url="https://audio/2.mp3" type="audio/mpeg" length="999"/>
      `)
    );
    const f = parseFeed(xml);
    expect(f.episodes).toHaveLength(2);
    expect(f.episodes[0]).toMatchObject({
      title: "Ep 1",
      guid: "guid-1",
      pubDate: "Mon, 01 Jan 2024 10:00:00 GMT",
      audioUrl: "https://audio/1.mp3",
      audioMime: "audio/mpeg",
      audioSize: 12345,
      durationSeconds: 3600,
    });
    expect(f.episodes[1].guid).toBeNull();
    expect(f.episodes[1].durationSeconds).toBeNull();
  });

  it("falls back through content:encoded / description / itunes:summary and strips HTML", () => {
    const withEncoded = feed(
      `<title>S</title>`,
      item(`<title>E</title><content:encoded><![CDATA[<p>Rich <b>body</b></p>]]></content:encoded><description>plain</description>`)
    );
    expect(parseFeed(withEncoded).episodes[0].description).toBe("Rich body");

    const descOnly = feed(`<title>S</title>`, item(`<title>E</title><description>just a desc</description>`));
    expect(parseFeed(descOnly).episodes[0].description).toBe("just a desc");

    const summaryOnly = feed(`<title>S</title>`, item(`<title>E</title><itunes:summary>sum</itunes:summary>`));
    expect(parseFeed(summaryOnly).episodes[0].description).toBe("sum");
  });

  it("defaults a missing item title and null enclosure fields", () => {
    const xml = feed(`<title>S</title>`, item(`<guid>g</guid>`));
    const ep = parseFeed(xml).episodes[0];
    expect(ep.title).toBe("Untitled episode");
    expect(ep.audioUrl).toBeNull();
    expect(ep.audioMime).toBeNull();
    expect(ep.audioSize).toBeNull();
  });

  it("ignores a non-numeric enclosure length", () => {
    const xml = feed(`<title>S</title>`, item(`<title>E</title><enclosure url="https://a/x.mp3" length="abc"/>`));
    expect(parseFeed(xml).episodes[0].audioSize).toBeNull();
  });

  it("reads episode-level itunes:image href", () => {
    const xml = feed(`<title>S</title>`, item(`<title>E</title><itunes:image href="https://img/ep.jpg"/>`));
    expect(parseFeed(xml).episodes[0].imageUrl).toBe("https://img/ep.jpg");
  });

  it("does not leak item-level tags into channel metadata", () => {
    const xml = feed(
      `<title>Channel Title</title>`,
      item(`<title>Episode Title</title>`)
    );
    expect(parseFeed(xml).title).toBe("Channel Title");
  });
});

describe("parseFeed — itunes:duration parsing", () => {
  const withDuration = (d: string) =>
    parseFeed(
      feed(`<title>S</title>`, `<item><title>E</title><itunes:duration>${d}</itunes:duration></item>`)
    ).episodes[0].durationSeconds;

  it("parses bare seconds", () => {
    expect(withDuration("90")).toBe(90);
    expect(withDuration("3600")).toBe(3600);
  });

  it("parses MM:SS", () => {
    expect(withDuration("05:30")).toBe(330);
    expect(withDuration("1:00")).toBe(60);
  });

  it("parses HH:MM:SS", () => {
    expect(withDuration("01:02:03")).toBe(3723);
    expect(withDuration("2:00:00")).toBe(7200);
  });

  it("returns null for malformed durations", () => {
    expect(withDuration("aa:bb")).toBeNull();
    expect(withDuration("1:2:3:4")).toBeNull();
  });

  it("returns null when duration is absent", () => {
    const xml = feed(`<title>S</title>`, `<item><title>E</title></item>`);
    expect(parseFeed(xml).episodes[0].durationSeconds).toBeNull();
  });
});
