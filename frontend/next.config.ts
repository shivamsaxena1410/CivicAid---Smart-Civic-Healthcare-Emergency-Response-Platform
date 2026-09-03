import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // This app is a sibling of `backend/` under a repo root that has no
    // lockfile of its own, so Turbopack's automatic root detection walks up
    // past the project. Pinning it keeps module resolution and file watching
    // inside frontend/.
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
