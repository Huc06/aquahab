import type { NextConfig } from "next";

// The crew server (server/) owns every Walrus, Tatum and LLM call. The browser talks to it through this
// same-origin proxy: the hosted Walrus relayer rejects browser origins, and keys never reach the client.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
