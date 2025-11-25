import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Enable for large file uploads (100MB+ PDFs with 1000+ pages)
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
