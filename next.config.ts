import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Artwork uploads go through server actions; matches MAX_UPLOAD_MB
    // (src/lib/files/types.ts) with room for the rest of the form.
    serverActions: { bodySizeLimit: "55mb" },
  },
};

export default nextConfig;
