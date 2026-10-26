"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { VisitasProvider } from "../context/VisitasContext";
import { OrelhinhaProvider } from "../context/OrelhinhaContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 10, // 10 segundos
            refetchInterval: 1000 * 15, // Auto-atualização periódica a cada 15 segundos no tablet
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <VisitasProvider>
        <OrelhinhaProvider>
          {children}
        </OrelhinhaProvider>
      </VisitasProvider>
    </QueryClientProvider>
  );
}
