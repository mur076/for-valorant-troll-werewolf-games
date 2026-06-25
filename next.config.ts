import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repositoryName = "for-valorant-troll-werewolf-games";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || (isProd ? `/${repositoryName}` : ""),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
