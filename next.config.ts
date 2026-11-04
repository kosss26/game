import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Самодостаточная сборка для Docker / своего сервера (.next/standalone)
  output: "standalone",
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  experimental: {
    cpus: 1, // Bound build workers on a shared VPS.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
