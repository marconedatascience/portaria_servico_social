"use client";

import React, { useState } from "react";
import { Clock, ShieldX, RefreshCw, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import { perfilDaSessao, rotaInicialDoPerfil } from "../lib/perfil";

interface AcessoPendenteProps {
  /** "pendente": conta sem setor aprovado. "negado": setor aprovado, mas sem acesso a esta tela. */
  motivo: "pendente" | "negado";
  email?: string;
}

export default function AcessoPendente({ motivo, email }: AcessoPendenteProps) {
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState("");

  // Busca um token novo: se a administração já aprovou, o setor passa a constar nele.
  const verificarNovamente = async () => {
    setVerificando(true);
    setAviso("");
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      setVerificando(false);
      setAviso("Não foi possível verificar agora. Tente novamente em instantes.");
      return;
    }
    window.location.reload();
  };

  const sair = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const pendente = motivo === "pendente";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-slate-50 to-green-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${pendente ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
          {pendente ? <Clock className="w-9 h-9" /> : <ShieldX className="w-9 h-9" />}
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {pendente ? "Aguardando aprovação" : "Acesso não permitido"}
        </h1>

        <p className="text-gray-600 text-sm mb-6">
          {pendente
            ? "Sua conta foi criada, mas ainda não tem setor liberado. Peça à administração do hospital para aprovar seu acesso."
            : "Seu setor não tem permissão para acessar esta tela."}
          {email && (
            <span className="block mt-2 font-semibold text-gray-800 break-all">{email}</span>
          )}
        </p>

        {aviso && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium text-left">
            {aviso}
          </div>
        )}

        <div className="space-y-3">
          {pendente ? (
            <button
              id="btn-verificar-aprovacao"
              type="button"
              onClick={verificarNovamente}
              disabled={verificando}
              className="w-full bg-primary-blue hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${verificando ? "animate-spin" : ""}`} />
              {verificando ? "Verificando..." : "Já fui aprovado — verificar novamente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const perfil = perfilDaSessao(session);
                const destino = perfil ? rotaInicialDoPerfil(perfil) : "/";
                window.location.replace(destino);
              }}
              className="block w-full bg-primary-blue hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Ir para o painel do meu setor
            </button>
          )}

          <button
            id="btn-sair-acesso-pendente"
            type="button"
            onClick={sair}
            className="w-full py-3.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
