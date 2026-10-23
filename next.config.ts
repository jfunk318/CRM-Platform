import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/catalog/image-hosts";

const nextConfig: NextConfig = {
  experimental: {
    // Artwork uploads go through server actions; matches MAX_UPLOAD_MB
    // (src/lib/files/types.ts) with room for the rest of the form.
    serverActions: { bodySizeLimit: "55mb" },
  },
  images: { remotePatterns: IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })) },
  // Lets the dev server be previewed through a temporary public tunnel
  // (Cloudflare or ngrok), plus any hosts listed in DEV_ORIGINS.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", ...(process.env.DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [])],
};

export default nextConfig;
