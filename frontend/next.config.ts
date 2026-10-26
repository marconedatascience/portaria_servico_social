import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite conexões de desenvolvimento e HMR WebSocket a partir de qualquer IP da rede local
  allowedDevOrigins: [
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "192.168.11.159",
    "192.168.11.159:3000",
    "192.168.*.*",
    "10.*.*.*",
    "*.local",
  ],
};

export default nextConfig;

