import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Самодостаточная сборка для Docker / своего сервера (.next/standalone)
  output: "standalone",
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Our only dynamic metadata is a local invitation lookup. Keep it in <head>
  // for Telegram's preview crawler instead of streaming it after the page body.
  htmlLimitedBots: /.*/,
  experimental: {
    cpus: 1, // Bound build workers on a shared VPS.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
