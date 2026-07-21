import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack inside this application. A parent-level lockfile on the
  // development machine must not make Next scan outside the Vercel project.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
