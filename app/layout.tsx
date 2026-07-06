import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The site's public base URL. Used as the root for all Open Graph / Twitter
// image + canonical URLs so shared links render correctly on social platforms.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sound-stage-live.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SoundStage Live",
    template: "%s · SoundStage Live",
  },
  description:
    "Create, produce, and publish your podcast — record or upload audio, " +
    "generate transcripts and show notes with AI, and distribute a " +
    "validated feed to Spotify and Apple Podcasts.",
  openGraph: {
    siteName: "SoundStage Live",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
