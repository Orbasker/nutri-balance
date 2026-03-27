import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["zlib-sync", "@discordjs/ws", "discord.js", "@chat-adapter/discord"],
};

export default nextConfig;
