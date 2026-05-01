import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.rpglogs.com",
      },
    ],
  },
  /* config options here */
};

export default nextConfig;
