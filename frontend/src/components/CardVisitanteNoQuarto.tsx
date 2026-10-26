"use client";

import React, { useMemo } from "react";
import { Users, UserMinus, FileText, Phone } from "lucide-react";
import { Visitante } from "@/services/api";

export interface CardVisitanteNoQuartoProps {
  /** Lista de visitantes ativos no quarto (array) */
  visitantes?: Visitante[];
  /** Prop de retrocompatibilidade para visitante único */
  visitante?: Visitante | null;
  /** Identificador do paciente/leito */
  pacienteId?: number;
  /** Callback para registro de saída, recebendo o ID do visitante e opcionalmente o ID do paciente */
  onSaidaVisitante?: (visitanteId: number, pacienteId?: number) => void;
  className?: string;
  /** Modo compacto (ex: para exibição dentro de tabelas) */
  compacto?: boolean;
}

export const CardVisitanteNoQuarto: React.FC<CardVisitanteNoQuartoProps> = ({
  visitantes,
  visitante,
  pacienteId,
  onSaidaVisitante,
  className = "",
  compacto = false,
}) => {
  // Filtra rigorosamente apenas visitantes normais de quarto, excluindo procedimentos e orelhinha
  const listaVisitantes: Visitante[] = useMemo(() => {
    const rawList: Visitante[] = Array.isArray(visitantes) && visitantes.length > 0
      ? visitantes
      : (visitante && visitante.nome ? [visitante] : []);

    return rawList.filter((v) => {
      if (!v || !v.nome) return false;
      if (v.isProcedimento) return false;
      if (v.tipoAcesso && v.tipoAcesso !== 'VISITANTE') return false;
      if (v.nome.startsWith('Orelhinha:') || v.nome.startsWith('Óbito:')) return false;
      return true;
    });
  }, [visitantes, visitante]);

  const temVisitantes = listaVisitantes.length > 0;

  // Renderização compacta para células de tabela
  if (compacto) {
    if (!temVisitantes) {
      return <span className="text-xs text-gray-400 italic">Quarto livre</span>;
    }

    return (
      <div className={`bg-green-50/90 border border-green-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-green-200/80 ${className}`}>
        {listaVisitantes.map((vis, index) => {
          const visId = vis.id ?? (index + 1);
          return (
            <div
              key={visId}
              className="flex items-center justify-between gap-2 p-2 border-b border-green-200/80 last:border-b-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-primary-green shrink-0 animate-pulse" />
                <span className="text-primary-green text-xs font-bold truncate" title={vis.nome}>
                  {vis.nome}
                </span>
              </div>
              {onSaidaVisitante && (
                <button
                  type="button"
                  onClick={() => onSaidaVisitante(visId, pacienteId)}
                  title={`Registrar Saída de ${vis.nome} (Check-out)`}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Renderização completa do Card Verde de Visitantes
  return (
    <div
      className={`bg-white/85 backdrop-blur-xs border border-emerald-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between transition-all ${className}`}
    >
      {/* Cabeçalho do Card Verde */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-emerald-100">
        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
          <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Visitantes no Quarto
        </span>
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
            temVisitantes
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {temVisitantes
            ? `${listaVisitantes.length} ${listaVisitantes.length > 1 ? "Presentes" : "Presente"}`
            : "Quarto Livre"}
        </span>
      </div>

      {/* Lista de Visitantes no Quarto (.map com borda inferior separadora) */}
      {!temVisitantes ? (
        <div className="py-2.5 text-center">
          <span className="text-xs text-slate-400 italic">Quarto livre (Nenhum visitante ativo)</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {listaVisitantes.map((vis, index) => {
            const visId = vis.id ?? (index + 1);
            const doc = vis.documento?.trim();
            const tel = vis.telefone?.trim();

            return (
              <div
                key={visId}
                className="py-2.5 border-b border-emerald-200/80 last:border-b-0 last:pb-0 first:pt-0 flex flex-col gap-1 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <span className="text-sm font-bold text-slate-800 truncate" title={vis.nome}>
                      {vis.nome}
                    </span>
                    {vis.data_entrada && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {vis.data_entrada.includes("T")
                          ? new Date(vis.data_entrada).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : vis.data_entrada}
                      </span>
                    )}
                  </div>

                  {onSaidaVisitante && (
                    <button
                      type="button"
                      onClick={() => onSaidaVisitante(visId, pacienteId)}
                      className="text-xs font-semibold text-amber-700 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-amber-200/70 hover:border-red-300"
                      title={`Registrar saída de ${vis.nome}`}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Saída</span>
                    </button>
                  )}
                </div>

                {/* Renderização condicional de Documento e Telefone do Visitante */}
                {(doc || tel) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pl-4">
                    {doc && (
                      <span className="inline-flex items-center gap-1 bg-white/95 px-2 py-0.5 rounded border border-emerald-200/80 text-slate-700 font-medium text-[11px]">
                        <FileText className="w-3 h-3 text-slate-400" />
                        Doc: <strong className="text-slate-800">{doc}</strong>
                      </span>
                    )}

                    {tel && (
                      <span className="inline-flex items-center gap-1 bg-white/95 px-2 py-0.5 rounded border border-emerald-200/80 text-slate-700 font-medium text-[11px]">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        Tel: <strong className="text-slate-800">{tel}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardVisitanteNoQuarto;
