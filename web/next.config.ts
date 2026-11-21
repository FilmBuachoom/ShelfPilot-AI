import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  outputFileTracingIncludes: {
    "/*": ["../data/*.json"],
    "/api/ingest": ["./prompts/extract-system.md", "./prompts/match-system.md"],
  },
};

export default nextConfig;
