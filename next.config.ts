import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@lancedb/lancedb", "pdf-parse", "mammoth"],
};

export default nextConfig;
