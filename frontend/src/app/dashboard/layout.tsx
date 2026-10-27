"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { perfilDaSessao, rotaInicialDoPerfil, type Perfil } from "../../lib/perfil";
import AcessoPendente from "../../components/AcessoPendente";

// Setores que podem abrir cada painel.
const PERMISSOES: Record<string, readonly Perfil[]> = {
  "/dashboard/portaria": ["portaria", "servico_social", "admin"],
  "/dashboard/fono": ["fono", "admin"],
};

type Estado = "verificando" | "ok" | "pendente" | "negado";

/**
 * Protege todas as rotas /dashboard/*: exige sessão válida E setor aprovado.
 * Obs.: a proteção real dos dados é feita pelo RLS do Supabase; isto evita exibir a tela.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setEmail(session.user.email ?? "");

      const perfil = perfilDaSessao(session);
      if (!perfil) {
        setEstado("pendente");
        return;
      }

      // Se acessar a raiz /dashboard ou /dashboard/, redireciona automaticamente para o painel correto do setor
      if (pathname === "/dashboard" || pathname === "/dashboard/") {
        const destino = rotaInicialDoPerfil(perfil);
        window.location.replace(destino);
        return;
      }

      const permitidos = Object.entries(PERMISSOES).find(([rota]) => pathname.startsWith(rota))?.[1];
      // Admin possui acesso universal. Demais perfis respeitam PERMISSOES
      const temPermissao = perfil === "admin" || (permitidos?.includes(perfil) ?? false);
      setEstado(temPermissao ? "ok" : "negado");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [pathname]);

  if (estado === "verificando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500 font-medium">
        Verificando acesso...
      </div>
    );
  }

  if (estado === "pendente" || estado === "negado") {
    return <AcessoPendente motivo={estado} email={email} />;
  }

  return <>{children}</>;
}
