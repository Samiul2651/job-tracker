import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page shows live job data, so nothing is cached or prerendered.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
