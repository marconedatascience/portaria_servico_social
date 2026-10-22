import type { NextConfig } from "next";

// Configuração enxuta e estável.
// Removidos: cacheComponents, partialPrefetching e o loader customizado de CSS do Turbopack,
// que causavam um loop infinito de recompilação/reload (página recarregando a cada ~200ms).
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
