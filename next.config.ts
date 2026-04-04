import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["zlib-sync", "@discordjs/ws", "discord.js", "@chat-adapter/discord"],
  headers: async () => [
    {
      source: "/icon.svg",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/apple-icon.png",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

export default nextConfig;
