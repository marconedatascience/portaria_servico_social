"use client";

import React, { useState } from "react";
import {
  Pencil,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  User,
  Bed,
  MapPin,
  Phone,
  CreditCard,
  Calendar,
} from "lucide-react";
import {
  maskData,
  ocultarCartaoSus,
  ocultarTelefone,
} from "../../lib/masks";
import {
  validarDataExame,
  validarHoraExame,
  somarDiasCalendario,
  hojeEmMaceio,
  type OrelhinhaItem,
  type RegrasAgenda,
} from "../../lib/schemas/orelhinha";
import { MaskedField } from "./MaskedField";

export interface OrelhinhaRowProps {
  item: OrelhinhaItem;
  permissoesCampos: string[];
  regras?: RegrasAgenda;
  destacado?: boolean;
  onSalvarAgenda?: (slotId: number, versao: number, payload: { data_exame?: string; horario?: string }) => Promise<void>;
  onAbrirEdicaoDemografica: (item: OrelhinhaItem) => void;
  temPendenciaOffline?: boolean;
}

export const OrelhinhaRow: React.FC<OrelhinhaRowProps> = ({
  item,
  permissoesCampos,
  regras,
  destacado = false,
  onSalvarAgenda,
  onAbrirEdicaoDemografica,
  temPendenciaOffline = false,
}) => {
  const [expandidoTablet, setExpandidoTablet] = useState(false);

  // Estados de edição inline para a Fonoaudiologia
  const [editandoData, setEditandoData] = useState(false);
  const [editandoHora, setEditandoHora] = useState(false);
  const [valorData, setValorData] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [erroData, setErroData] = useState<string | undefined>();
  const [erroHora, setErroHora] = useState<string | undefined>();
  const [salvandoInline, setSalvandoInline] = useState(false);

  const podeEditarData = permissoesCampos.includes("data_exame");
  const podeEditarHora = permissoesCampos.includes("horario");
  const podeEditarDemografico =
    permissoesCampos.includes("cartao_sus") ||
    permissoesCampos.includes("nome_mae") ||
    permissoesCampos.includes("municipio") ||
    permissoesCampos.includes("telefone");

  // Início da edição inline
  const iniciarEdicaoData = () => {
    setValorData(maskData(item.data_exame));
    setErroData(undefined);
    setEditandoData(true);
  };

  const iniciarEdicaoHora = () => {
    setValorHora(item.horario);
    setErroHora(undefined);
    setEditandoHora(true);
  };

  // Salvar Data Inline (Fono)
  const salvarData = async () => {
    if (!onSalvarAgenda || !regras) return;
    const ctx = {
      regras,
      hoje: hojeEmMaceio(),
      dataNascimento: item.data_nascimento,
      somarDias: somarDiasCalendario,
    };
    const r = validarDataExame(valorData, ctx);
    if (!r.ok) {
      setErroData(r.mensagem);
      return;
    }
    if (r.valor === item.data_exame) {
      setEditandoData(false);
      return;
    }

    setSalvandoInline(true);
    try {
      await onSalvarAgenda(item.id, item.versao, { data_exame: r.valor });
      setEditandoData(false);
    } catch (err: unknown) {
      setErroData(err instanceof Error ? err.message : "Erro ao salvar data");
    } finally {
      setSalvandoInline(false);
    }
  };

  // Salvar Hora Inline (Fono)
  const salvarHora = async () => {
    if (!onSalvarAgenda || !regras) return;
    const r = validarHoraExame(valorHora, regras);
    if (!r.ok) {
      setErroHora(r.mensagem);
      return;
    }
    if (r.valor === item.horario) {
      setEditandoHora(false);
      return;
    }

    setSalvandoInline(true);
    try {
      await onSalvarAgenda(item.id, item.versao, { horario: r.valor });
      setEditandoHora(false);
    } catch (err: unknown) {
      setErroHora(err instanceof Error ? err.message : "Erro ao salvar hora");
    } finally {
      setSalvandoInline(false);
    }
  };

  // Render do Status com ponto semântico discreto (Clean Hospitalar)
  const renderStatus = (status: string) => {
    const s = status.toUpperCase();
    let dotColor = "bg-slate-400";
    let label = status;

    if (s.includes("AGENDADO") || s.includes("CONFIRMADO")) {
      dotColor = "bg-emerald-500";
      label = "Agendado";
    } else if (s.includes("REALIZADO") || s.includes("CONCLUIDO")) {
      dotColor = "bg-sky-500";
      label = "Concluído";
    } else if (s.includes("PENDENTE") || s.includes("FALTA")) {
      dotColor = "bg-amber-500";
      label = "Pendente";
    } else if (s.includes("CANCELADO") || s.includes("REMARCADO")) {
      dotColor = "bg-rose-500";
      label = "Cancelado";
    }

    return (
      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
        <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} aria-hidden="true" />
        <span>{label}</span>
      </div>
    );
  };

  return (
    <>
      <tr
        className={`
          border-b border-slate-100 transition-colors duration-200 min-h-[48px]
          ${destacado ? "bg-sky-50/80 animate-pulse" : "hover:bg-slate-50/70"}
        `}
      >
        {/* 1. Recém-Nascido & Leito */}
        <td className="px-4 py-3.5 align-middle">
          <div className="flex flex-col">
            <span className="text-[14px] font-medium text-slate-900 leading-tight">
              {item.nome_rn || "Recém-Nascido"}
            </span>
            <span className="text-[12px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Bed className="w-3 h-3 text-slate-400" />
              <span>{item.leito || "Sem leito"}</span>
            </span>
            {temPendenciaOffline && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 w-max border border-amber-200">
                <CloudOff className="w-3 h-3" />
                <span>Edição offline pendente</span>
              </span>
            )}
          </div>
        </td>

        {/* 2. Data do Exame (Inline Fono ou Texto Portaria) */}
        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
          {editandoData ? (
            <div className="flex items-center gap-1.5">
              <MaskedField
                label=""
                tipo="data"
                value={valorData}
                onChange={setValorData}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarData();
                  if (e.key === "Escape") setEditandoData(false);
                }}
                error={erroData}
                autoFocus
                className="w-32"
              />
              <button
                type="button"
                onClick={salvarData}
                disabled={salvandoInline}
                aria-label="Salvar data"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                {salvandoInline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setEditandoData(false)}
                disabled={salvandoInline}
                aria-label="Cancelar edição"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-[14px] text-slate-900 font-medium">
                {maskData(item.data_exame)}
              </span>
              {podeEditarData && (
                <button
                  type="button"
                  onClick={iniciarEdicaoData}
                  aria-label="Editar data do exame"
                  title="Editar data do exame"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 group-hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </td>

        {/* 3. Hora do Exame (Inline Fono ou Texto Portaria) */}
        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
          {editandoHora ? (
            <div className="flex items-center gap-1.5">
              <MaskedField
                label=""
                tipo="hora"
                value={valorHora}
                onChange={setValorHora}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarHora();
                  if (e.key === "Escape") setEditandoHora(false);
                }}
                error={erroHora}
                autoFocus
                className="w-24"
              />
              <button
                type="button"
                onClick={salvarHora}
                disabled={salvandoInline}
                aria-label="Salvar horário"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                {salvandoInline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setEditandoHora(false)}
                disabled={salvandoInline}
                aria-label="Cancelar edição"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-[14px] text-slate-900 font-medium">
                {item.horario}
              </span>
              {podeEditarHora && (
                <button
                  type="button"
                  onClick={iniciarEdicaoHora}
                  aria-label="Editar horário do exame"
                  title="Editar horário do exame"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 group-hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </td>

        {/* 4. Status */}
        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
          {renderStatus(item.status)}
        </td>

        {/* 5. Campos Demográficos (Visíveis em Desktop xl) */}
        <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
          {ocultarCartaoSus(item.cartao_sus)}
        </td>
        <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
          {item.data_nascimento ? maskData(item.data_nascimento) : "—"} ({item.sexo || "—"})
        </td>
        <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 max-w-[150px] truncate">
          {item.nome_mae || "—"}
        </td>
        <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 max-w-[130px] truncate">
          {item.municipio || "—"}
        </td>
        <td className="hidden xl:table-cell px-4 py-3.5 align-middle text-[13px] text-slate-700 whitespace-nowrap">
          {ocultarTelefone(item.telefone)}
        </td>

        {/* 6. Ações */}
        <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5">
            {/* Botão de Edição Demográfica (Portaria / Serviço Social) */}
            {podeEditarDemografico && (
              <button
                type="button"
                onClick={() => onAbrirEdicaoDemografica(item)}
                className="min-h-[44px] px-3.5 py-1.5 text-[13px] font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar Dados</span>
              </button>
            )}

            {/* Botão de Expandir no Tablet (< xl) */}
            <button
              type="button"
              onClick={() => setExpandidoTablet(!expandidoTablet)}
              aria-label={expandidoTablet ? "Ocultar detalhes do paciente" : "Ver detalhes do paciente"}
              className="xl:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {expandidoTablet ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Linha Expansível para Tablet (< xl) */}
      {expandidoTablet && (
        <tr className="xl:hidden bg-slate-50/80 border-b border-slate-200/60">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[13px]">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                  <span>Cartão SUS (CNS)</span>
                </span>
                <span className="text-slate-800 font-medium mt-0.5">
                  {ocultarCartaoSus(item.cartao_sus)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Nascimento & Sexo</span>
                </span>
                <span className="text-slate-800 mt-0.5">
                  {item.data_nascimento ? maskData(item.data_nascimento) : "—"} (
                  {item.sexo === "F" ? "Feminino" : item.sexo === "M" ? "Masculino" : "—"})
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Nome da Mãe</span>
                </span>
                <span className="text-slate-800 mt-0.5">{item.nome_mae || "—"}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Município</span>
                </span>
                <span className="text-slate-800 mt-0.5">{item.municipio || "—"}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>Telefone</span>
                </span>
                <span className="text-slate-800 mt-0.5">{ocultarTelefone(item.telefone)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
