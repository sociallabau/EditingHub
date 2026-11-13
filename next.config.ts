import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" }, staleTimes: { dynamic: 60, static: 300 } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
};

export default nextConfig;
