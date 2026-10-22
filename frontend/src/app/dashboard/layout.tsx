"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { perfilDaSessao, type Perfil } from "../../lib/perfil";
import AcessoPendente from "../../components/AcessoPendente";

// Setores que podem abrir cada painel.
const PERMISSOES: Record<string, readonly Perfil[]> = {
  "/dashboard/portaria": ["portaria", "servico_social"],
  "/dashboard/fono": ["fono"],
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
      const permitidos = Object.entries(PERMISSOES).find(([rota]) => pathname.startsWith(rota))?.[1];
      // Rota /dashboard sem regra explícita: nega por padrão.
      setEstado(permitidos?.includes(perfil) ? "ok" : "negado");
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
