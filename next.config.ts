import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@lancedb/lancedb", "pdf-parse", "mammoth"],
};

export default nextConfig;
