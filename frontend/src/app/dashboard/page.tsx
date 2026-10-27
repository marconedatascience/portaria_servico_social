"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { perfilDaSessao, rotaInicialDoPerfil } from "@/lib/perfil";

export default function DashboardIndexPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const perfil = perfilDaSessao(session);
      const destino = perfil ? rotaInicialDoPerfil(perfil) : "/login";
      window.location.replace(destino);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500 font-medium">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Redirecionando para o seu painel de trabalho...</p>
      </div>
    </div>
  );
}
