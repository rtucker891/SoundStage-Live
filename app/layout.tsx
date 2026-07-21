import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

// Body font: clean, highly readable workhorse for paragraphs, buttons, UI.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display font: tall, condensed, bold — used for headlines to give the brand
// its broadcast/media character. Loaded in a few weights we actually use.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// The site's public base URL. Used as the root for all Open Graph / Twitter
// image + canonical URLs so shared links render correctly on social platforms.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sound-stage-live.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SoundStage",
    template: "%s · SoundStage",
  },
  description:
    "Record, edit, publish, monetize, and grow your podcast from one creator workspace.",
  openGraph: {
    siteName: "SoundStage",
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
