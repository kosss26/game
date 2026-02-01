import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better Telegram MiniApp support
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
