"use client";

import React, { useState } from "react";
import {
  Lock,
  RefreshCw,
  AlertCircle,
  CalendarCheck,
  Search,
  WifiOff,
  CloudUpload,
} from "lucide-react";
import { useOrelhinhaAgenda } from "../../hooks/useOrelhinhaAgenda";
import { useOrelhinhaPermissoes } from "../../hooks/useOrelhinhaPermissoes";
import { useOrelhinhaSync } from "../../hooks/useOrelhinhaSync";
import { OrelhinhaRow } from "./OrelhinhaRow";
import { EditSheet } from "./EditSheet";
import { useOfflineQueueStore } from "../../lib/sync/offlineQueue";
import type { OrelhinhaItem, DemograficoPayload } from "../../lib/schemas/orelhinha";

export interface OrelhinhaTableProps {
  className?: string;
}

export const OrelhinhaTable: React.FC<OrelhinhaTableProps> = ({ className = "" }) => {
  const {
    itens,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    mutacaoAgenda,
    mutacaoDemografico,
    regras,
  } = useOrelhinhaAgenda();

  const { permissoesCampos, podeEditar } = useOrelhinhaPermissoes();
  const {
    idsDestacados,
    mensagemAria,
    pendenciasCount,
    estaSincronizandoFila,
    processarFilaManualmente,
  } = useOrelhinhaSync();

  const filaStore = useOfflineQueueStore();

  const [busca, setBusca] = useState("");
  const [itemEmEdicao, setItemEmEdicao] = useState<OrelhinhaItem | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  // Filtragem de busca no cliente
  const itensFiltrados = React.useMemo(() => {
    if (!busca.trim()) return itens;
    const termo = busca.toLowerCase();
    return itens.filter((it) => {
      const nome = (it.nome_rn ?? "").toLowerCase();
      const leito = (it.leito ?? "").toLowerCase();
      const mae = (it.nome_mae ?? "").toLowerCase();
      const sus = (it.cartao_sus ?? "").toLowerCase();
      return (
        nome.includes(termo) ||
        leito.includes(termo) ||
        mae.includes(termo) ||
        sus.includes(termo)
      );
    });
  }, [itens, busca]);

  const podeEditarData = podeEditar("data_exame");
  const podeEditarHora = podeEditar("horario");

  const handleSalvarAgenda = async (
    slotId: number,
    versao: number,
    payload: { data_exame?: string; horario?: string },
  ) => {
    await mutacaoAgenda.mutateAsync({ slotId, versao, payload });
  };

  const handleAbrirEdicaoDemografica = (item: OrelhinhaItem) => {
    setItemEmEdicao(item);
    setSheetAberto(true);
  };

  const handleSalvarDemografico = async (
    itemOriginal: OrelhinhaItem,
    payload: DemograficoPayload,
  ) => {
    await mutacaoDemografico.mutateAsync({
      slotId: itemOriginal.id,
      itemOriginal,
      novosValores: payload,
    });
  };

  const idsPendentesOffline = React.useMemo(() => {
    const map = new Set<number>();
    for (const it of filaStore.itens) {
      if (it.status === "pendente" || it.status === "falha") {
        map.add(it.slotId);
      }
    }
    return map;
  }, [filaStore.itens]);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`}
    >
      {/* Região ao vivo para leitores de tela (WCAG AA) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {mensagemAria}
      </div>

      {/* Cabeçalho Neutro e Limpo (Clean Hospitalar - sem gradiente roxo) */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900 leading-tight">
                Agenda do Teste da Orelhinha
              </h2>
              <span className="text-[12px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {itensFiltrados.length} {itensFiltrados.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Triagem Auditiva Neonatal • Fonoaudiologia & Portaria
            </p>
          </div>
        </div>

        {/* Indicadores de Bloqueio, Fila Offline e Atualização */}
        <div className="flex items-center gap-2.5">
          {pendenciasCount > 0 && (
            <button
              type="button"
              onClick={processarFilaManualmente}
              disabled={estaSincronizandoFila}
              title="Clique para forçar a sincronização dos dados salvos no tablet"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              {estaSincronizandoFila ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>
                {pendenciasCount} {pendenciasCount === 1 ? "pendência offline" : "pendências offline"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            aria-label="Atualizar lista"
            title="Atualizar lista"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading || isRefetching ? "animate-spin text-sky-600" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Barra de Filtro Rápido */}
      <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-200/80 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por recém-nascido, mãe, leito..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-[13px] text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 placeholder:text-slate-400"
          />
        </div>
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="text-[12px] text-slate-500 hover:text-slate-800 underline"
          >
            Limpar busca
          </button>
        )}
      </div>

      {/* Conteúdo da Tabela / Estados */}
      {isLoading ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
          <p className="text-[14px] text-slate-600 font-medium">Carregando agenda do hospital...</p>
        </div>
      ) : isError ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Falha ao carregar a agenda</h3>
            <p className="text-[13px] text-slate-500 mt-1 max-w-sm">
              {error instanceof Error ? error.message : "Não foi possível conectar ao servidor."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-[44px] px-4 py-2 mt-2 text-[14px] font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
          <CalendarCheck className="w-8 h-8 text-slate-300" />
          <h3 className="text-[14px] font-medium text-slate-700">Nenhum exame agendado encontrado</h3>
          <p className="text-[12px] text-slate-400">
            {busca ? "Tente alterar os termos da busca acima." : "Nenhum paciente aguardando teste da orelhinha."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[12px] font-semibold text-slate-600 tracking-wider uppercase select-none">
                <th scope="col" className="px-4 py-3">
                  Recém-Nascido / Leito
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>Data Exame</span>
                    {!podeEditarData && (
                      <span
                        title="Editável apenas pela Fonoaudiologia"
                        aria-label="Editável apenas pela Fonoaudiologia"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>Hora</span>
                    {!podeEditarHora && (
                      <span
                        title="Editável apenas pela Fonoaudiologia"
                        aria-label="Editável apenas pela Fonoaudiologia"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3 whitespace-nowrap">
                  Cartão SUS
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3 whitespace-nowrap">
                  Nasc. / Sexo
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3">
                  Mãe
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3">
                  Município
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3 whitespace-nowrap">
                  Telefone
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((item) => (
                <OrelhinhaRow
                  key={item.id}
                  item={item}
                  permissoesCampos={permissoesCampos}
                  regras={regras}
                  destacado={idsDestacados.has(item.id)}
                  onSalvarAgenda={handleSalvarAgenda}
                  onAbrirEdicaoDemografica={handleAbrirEdicaoDemografica}
                  temPendenciaOffline={idsPendentesOffline.has(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Painel Lateral de Edição Demográfica (Side Sheet) */}
      <EditSheet
        item={itemEmEdicao}
        aberto={sheetAberto}
        onFechar={() => {
          setSheetAberto(false);
          setItemEmEdicao(null);
        }}
        onSalvar={handleSalvarDemografico}
        permissoesCampos={permissoesCampos}
        estaSalvando={mutacaoDemografico.isPending}
      />
    </div>
  );
};
