"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  Phone,
  User,
  MapPin,
  CreditCard,
  Lock,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Search,
  Check,
  X,
  Stethoscope,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Bed,
  CloudOff,
  CloudUpload,
  RefreshCw,
} from "lucide-react";
import { useOrelhinhaStore, ConsultaOrelhinhaItem } from "../context/OrelhinhaContext";
import { perfil_atual, canEditDataHora, canEditDemograficos, canCheckin, Perfil } from "../lib/perfil";
import {
  maskCartaoSus,
  maskData,
  maskHora,
  maskTelefone,
  ocultarCartaoSus,
  ocultarTelefone,
} from "../lib/masks";
import { MaskedField } from "./orelhinha/MaskedField";
import { EditSheet } from "./orelhinha/EditSheet";
import { useOfflineQueueStore } from "../lib/sync/offlineQueue";
import type { OrelhinhaItem, DemograficoPayload } from "../lib/schemas/orelhinha";

interface OrelhinhaTableProps {
  perfilProp?: Perfil;
  onRealizarExameClinico?: (consulta: ConsultaOrelhinhaItem) => void;
  titulo?: string;
  subtitulo?: string;
  className?: string;
}

export default function OrelhinhaTable({
  perfilProp,
  onRealizarExameClinico,
  titulo = "Agenda do Teste da Orelhinha",
  subtitulo = "Triagem Auditiva Neonatal • Fonoaudiologia & Portaria",
  className = "",
}: OrelhinhaTableProps) {
  const {
    consultas,
    atualizarConsultaOrelhinha,
    realizarCheckin,
    sincronizarEmTempoReal,
  } = useOrelhinhaStore();

  const filaStore = useOfflineQueueStore();

  // Perfil reativo
  const [perfil, setPerfil] = useState<Perfil>(() => perfilProp || perfil_atual());

  useEffect(() => {
    if (perfilProp) setPerfil(perfilProp);
    else setPerfil(perfil_atual());
  }, [perfilProp]);

  // Permissões RBAC (vêm de regras centralizadas)
  const fonoPodeEditarDataHora = canEditDataHora(perfil);
  const podeEditarDemograficos = canEditDemograficos(perfil);
  const podeFazerCheckin = canCheckin(perfil);

  const permissoesCampos = useMemo(() => {
    const lista: string[] = [];
    if (fonoPodeEditarDataHora) {
      lista.push("data_exame", "horario");
    }
    if (podeEditarDemograficos) {
      lista.push("cartao_sus", "nome_mae", "municipio", "telefone");
    }
    return lista;
  }, [fonoPodeEditarDataHora, podeEditarDemograficos]);

  // Estados de busca e filtros
  const [busca, setBusca] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"TODOS" | "CHECKIN_PENDENTE" | "CHECKIN_FEITO">("TODOS");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  // Edição Demográfica (Side Sheet da Portaria)
  const [itemEmEdicaoSheet, setItemEmEdicaoSheet] = useState<OrelhinhaItem | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [salvandoSheet, setSalvandoSheet] = useState(false);

  // Edição Inline de Data/Hora (Fonoaudiologia)
  const [editandoDataId, setEditandoDataId] = useState<number | null>(null);
  const [editandoHoraId, setEditandoHoraId] = useState<number | null>(null);
  const [valorInlineData, setValorInlineData] = useState("");
  const [valorInlineHora, setValorInlineHora] = useState("");

  // Notificações acessíveis
  const [notificacao, setNotificacao] = useState<{ tipo: "sucesso" | "erro" | "info"; msg: string } | null>(null);

  const mostrarNotificacao = (tipo: "sucesso" | "erro" | "info", msg: string) => {
    setNotificacao({ tipo, msg });
    setTimeout(() => setNotificacao(null), 4000);
  };

  const toggleExpandir = (id: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Check-in de chegada na portaria
  const handleCheckinClick = (id: number, nomeMae?: string) => {
    realizarCheckin(id);
    mostrarNotificacao("sucesso", `Check-in de ${nomeMae || "paciente"} registrado.`);
  };

  // Abrir side sheet demográfico (Portaria / Serviço Social)
  const handleAbrirEdicaoSheet = (c: ConsultaOrelhinhaItem) => {
    const itemFormatado: OrelhinhaItem = {
      id: c.id,
      nome_rn: c.paciente,
      leito: c.leito,
      cartao_sus: c.cartaoSus ? c.cartaoSus.replace(/\D/g, "") : null,
      data_nascimento: c.dataNascimento ? c.dataNascimento : null,
      sexo: c.sexo || "F",
      nome_mae: c.nomeMae || null,
      municipio: c.municipio || null,
      telefone: c.telefone ? c.telefone.replace(/\D/g, "") : null,
      data_exame: c.data,
      horario: c.horario,
      status: c.status,
      versao: 1,
      atualizado_em: null,
    };
    setItemEmEdicaoSheet(itemFormatado);
    setSheetAberto(true);
  };

  // Salvar demográfico do side sheet
  const handleSalvarDemografico = async (itemOriginal: OrelhinhaItem, payload: DemograficoPayload) => {
    setSalvandoSheet(true);
    try {
      const payloadContext: Partial<ConsultaOrelhinhaItem> = {};
      if (payload.cartao_sus !== undefined) payloadContext.cartaoSus = maskCartaoSus(payload.cartao_sus);
      if (payload.nome_mae !== undefined) payloadContext.nomeMae = payload.nome_mae;
      if (payload.municipio !== undefined) payloadContext.municipio = payload.municipio;
      if (payload.telefone !== undefined) payloadContext.telefone = maskTelefone(payload.telefone);

      // Enfileira offline se estiver sem rede
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        filaStore.enfileirar(itemOriginal.id, itemOriginal.versao, payload);
      }

      atualizarConsultaOrelhinha(itemOriginal.id, payloadContext);
      mostrarNotificacao("sucesso", `Dados de ${payload.nome_mae || itemOriginal.nome_mae || "paciente"} atualizados com sucesso.`);
    } finally {
      setSalvandoSheet(false);
    }
  };

  // Salvar Data Inline (Fono)
  const salvarDataInline = (c: ConsultaOrelhinhaItem) => {
    if (!valorInlineData.trim()) {
      setEditandoDataId(null);
      return;
    }
    atualizarConsultaOrelhinha(c.id, { data: valorInlineData, status: "Reagendado" });
    setEditandoDataId(null);
    mostrarNotificacao("sucesso", `Data do exame de ${c.nomeMae} alterada para ${valorInlineData}.`);
  };

  // Salvar Hora Inline (Fono)
  const salvarHoraInline = (c: ConsultaOrelhinhaItem) => {
    if (!valorInlineHora.trim()) {
      setEditandoHoraId(null);
      return;
    }
    atualizarConsultaOrelhinha(c.id, { horario: valorInlineHora, status: "Reagendado" });
    setEditandoHoraId(null);
    mostrarNotificacao("sucesso", `Horário do exame de ${c.nomeMae} alterado para ${valorInlineHora}.`);
  };

  // Filtro de buscas
  const consultasFiltradas = useMemo(() => {
    return consultas.filter((item) => {
      const q = busca.toLowerCase().trim();
      const matchBusca =
        !q ||
        item.nomeMae?.toLowerCase().includes(q) ||
        item.cartaoSus?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        item.municipio?.toLowerCase().includes(q) ||
        item.paciente?.toLowerCase().includes(q) ||
        item.leito?.toLowerCase().includes(q) ||
        item.telefone?.includes(q);

      if (!matchBusca) return false;

      if (filtroCheckin === "CHECKIN_PENDENTE") return !item.checkinPortaria;
      if (filtroCheckin === "CHECKIN_FEITO") return Boolean(item.checkinPortaria);

      return true;
    });
  }, [consultas, busca, filtroCheckin]);

  const pendenciasCount = filaStore.itens.filter(
    (it) => it.status === "pendente" || it.status === "sincronizando",
  ).length;

  return (
    <div className={`w-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Notificação flutuante com WCAG AA */}
      {notificacao && (
        <div
          role="status"
          aria-live="polite"
          className={`px-5 py-3.5 flex items-center justify-between text-[13px] font-medium border-b transition-colors duration-150 ${
            notificacao.tipo === "sucesso"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : notificacao.tipo === "erro"
              ? "bg-rose-50 text-rose-900 border-rose-200"
              : "bg-sky-50 text-sky-900 border-sky-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notificacao.msg}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotificacao(null)}
            aria-label="Fechar notificação"
            className="text-slate-400 hover:text-slate-700 min-w-[32px] min-h-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho Limpo e Neutro (Clean Hospitalar — sem gradiente roxo) */}
      <div className="px-6 py-4.5 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 flex-shrink-0">
            <CalendarCheck className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
                {titulo}
              </h2>
              <span className="text-[12px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {consultasFiltradas.length} {consultasFiltradas.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {subtitulo}
            </p>
          </div>
        </div>

        {/* Badges e Ações do Cabeçalho */}
        <div className="flex items-center gap-2.5">
          {!fonoPodeEditarDataHora && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80"
              title="A Portaria/Serviço Social edita apenas dados cadastrais. Data e horário são restritos à Fonoaudiologia."
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Data/Hora restritas à Fono</span>
            </span>
          )}

          {pendenciasCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200"
              title="Edições demográficas salvas offline no tablet prontas para sincronizar"
            >
              <CloudOff className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendenciasCount} offline</span>
            </span>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por mãe, recém-nascido, leito, SUS ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-10 pr-3.5 text-[14px] text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 placeholder:text-slate-400"
          />
        </div>

        {/* Filtro de Check-in */}
        <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-lg self-start md:self-auto">
          <button
            type="button"
            onClick={() => setFiltroCheckin("TODOS")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              filtroCheckin === "TODOS"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos ({consultas.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroCheckin("CHECKIN_PENDENTE")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              filtroCheckin === "CHECKIN_PENDENTE"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Aguardando Chegada
          </button>
          <button
            type="button"
            onClick={() => setFiltroCheckin("CHECKIN_FEITO")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              filtroCheckin === "CHECKIN_FEITO"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Presentes (Check-in OK)
          </button>
        </div>
      </div>

      {/* Tabela Clean Hospitalar (Superfície Única) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[12px] font-semibold text-slate-600 tracking-wider uppercase select-none">
              <th scope="col" className="px-5 py-3.5">
                Recém-Nascido / Leito
              </th>
              <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span>Data Exame</span>
                  {!fonoPodeEditarDataHora && (
                    <span title="Editável apenas pela Fonoaudiologia" aria-label="Editável apenas pela Fonoaudiologia">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                  )}
                </div>
              </th>
              <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span>Hora</span>
                  {!fonoPodeEditarDataHora && (
                    <span title="Editável apenas pela Fonoaudiologia" aria-label="Editável apenas pela Fonoaudiologia">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                  )}
                </div>
              </th>
              <th scope="col" className="px-4 py-3.5 whitespace-nowrap">
                Status
              </th>
              <th scope="col" className="hidden xl:table-cell px-4 py-3.5 whitespace-nowrap">
                Cartão SUS
              </th>
              <th scope="col" className="hidden xl:table-cell px-4 py-3.5 whitespace-nowrap">
                Nasc. / Sexo
              </th>
              <th scope="col" className="hidden xl:table-cell px-4 py-3.5">
                Mãe
              </th>
              <th scope="col" className="hidden xl:table-cell px-4 py-3.5">
                Município
              </th>
              <th scope="col" className="hidden xl:table-cell px-4 py-3.5 whitespace-nowrap">
                Telefone
              </th>
              <th scope="col" className="px-5 py-3.5 text-right whitespace-nowrap">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {consultasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium text-[14px]">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              consultasFiltradas.map((c) => {
                const estaExpandido = expandidos.has(c.id);

                return (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors duration-150 min-h-[48px] group">
                      {/* 1. Recém-Nascido & Leito */}
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-semibold text-slate-900 leading-tight">
                            {c.paciente}
                          </span>
                          <span className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Bed className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.leito}</span>
                          </span>
                        </div>
                      </td>

                      {/* 2. Data do Exame (Inline Fono ou Texto Portaria) */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        {editandoDataId === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <MaskedField
                              label=""
                              tipo="data"
                              value={valorInlineData}
                              onChange={setValorInlineData}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarDataInline(c);
                                if (e.key === "Escape") setEditandoDataId(null);
                              }}
                              autoFocus
                              className="w-32"
                            />
                            <button
                              type="button"
                              onClick={() => salvarDataInline(c)}
                              aria-label="Salvar data"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoDataId(null)}
                              aria-label="Cancelar"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] text-slate-900 font-medium">
                              {c.data}
                            </span>
                            {fonoPodeEditarDataHora && (
                              <button
                                type="button"
                                onClick={() => {
                                  setValorInlineData(c.data);
                                  setEditandoDataId(c.id);
                                }}
                                title="Editar data do exame"
                                aria-label="Editar data do exame"
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 group-hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Hora do Exame (Inline Fono ou Texto Portaria) */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        {editandoHoraId === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <MaskedField
                              label=""
                              tipo="hora"
                              value={valorInlineHora}
                              onChange={setValorInlineHora}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarHoraInline(c);
                                if (e.key === "Escape") setEditandoHoraId(null);
                              }}
                              autoFocus
                              className="w-24"
                            />
                            <button
                              type="button"
                              onClick={() => salvarHoraInline(c)}
                              aria-label="Salvar hora"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoHoraId(null)}
                              aria-label="Cancelar"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] text-slate-900 font-medium">
                              {c.horario}
                            </span>
                            {fonoPodeEditarDataHora && (
                              <button
                                type="button"
                                onClick={() => {
                                  setValorInlineHora(c.horario);
                                  setEditandoHoraId(c.id);
                                }}
                                title="Editar horário do exame"
                                aria-label="Editar horário do exame"
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 group-hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Status (Ponto Semântico Hospitalar) */}
                      <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              c.status === "Realizado"
                                ? "bg-sky-500"
                                : c.status === "Reagendado"
                                ? "bg-amber-500"
                                : c.status === "Cancelado"
                                ? "bg-rose-500"
                                : "bg-emerald-500"
                            }`}
                            aria-hidden="true"
                          />
                          <span>{c.status}</span>
                        </div>
                      </td>

                      {/* 5. Campos Demográficos (Desktop xl) com LGPD */}
                      <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
                        {ocultarCartaoSus(c.cartaoSus)}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
                        {c.dataNascimento} ({c.sexo || "—"})
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-900 font-medium max-w-[160px] truncate">
                        {c.nomeMae}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 max-w-[130px] truncate">
                        {c.municipio || "—"}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
                        {ocultarTelefone(c.telefone)}
                      </td>

                      {/* 6. Ações */}
                      <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Check-in Portaria */}
                          {podeFazerCheckin && (
                            c.checkinPortaria ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                                title={`Check-in realizado às ${c.checkinHorario || "horário confirmado"}`}
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Presente ({c.checkinHorario || "OK"})</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCheckinClick(c.id, c.nomeMae)}
                                className="min-h-[44px] px-3.5 py-1.5 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg transition-all shadow-2xs flex items-center gap-1.5"
                                title="Confirmar chegada da mãe na portaria"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Check-in</span>
                              </button>
                            )
                          )}

                          {/* Botão de Edição Demográfica (Side Sheet) */}
                          {podeEditarDemograficos && (
                            <button
                              type="button"
                              onClick={() => handleAbrirEdicaoSheet(c)}
                              className="min-h-[44px] px-3.5 py-1.5 text-[13px] font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors flex items-center gap-1.5"
                              title="Editar dados demográficos da mãe e recém-nascido"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          )}

                          {/* Se for Fonoaudiólogo e tiver callback clínico */}
                          {fonoPodeEditarDataHora && onRealizarExameClinico && (
                            <button
                              type="button"
                              onClick={() => onRealizarExameClinico(c)}
                              className="min-h-[44px] px-3.5 py-1.5 text-[13px] font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>Parecer</span>
                            </button>
                          )}

                          {/* Chevron de expansão no Tablet (< xl) */}
                          <button
                            type="button"
                            onClick={() => toggleExpandir(c.id)}
                            aria-label={estaExpandido ? "Ocultar detalhes" : "Ver detalhes"}
                            className="xl:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            {estaExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Linha Expansível para Tablet (< xl) */}
                    {estaExpandido && (
                      <tr className="xl:hidden bg-slate-50/90 border-b border-slate-200/80">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-[13px]">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cartão SUS (CNS)</span>
                              </span>
                              <span className="text-slate-900 font-medium mt-0.5">
                                {ocultarCartaoSus(c.cartaoSus)}
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Nascimento & Sexo</span>
                              </span>
                              <span className="text-slate-800 mt-0.5">
                                {c.dataNascimento} ({c.sexo === "F" ? "Feminino" : "Masculino"})
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>Nome da Mãe</span>
                              </span>
                              <span className="text-slate-900 font-medium mt-0.5">{c.nomeMae}</span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Município</span>
                              </span>
                              <span className="text-slate-800 mt-0.5">{c.municipio || "—"}</span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span>Telefone</span>
                              </span>
                              <span className="text-slate-800 mt-0.5">{ocultarTelefone(c.telefone)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Painel Lateral (Side Sheet) de Edição Demográfica da Portaria */}
      <EditSheet
        item={itemEmEdicaoSheet}
        aberto={sheetAberto}
        onFechar={() => {
          setSheetAberto(false);
          setItemEmEdicaoSheet(null);
        }}
        onSalvar={handleSalvarDemografico}
        permissoesCampos={permissoesCampos}
        estaSalvando={salvandoSheet}
      />
    </div>
  );
}
