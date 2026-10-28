"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Loader2, User, Bed, ShieldAlert } from "lucide-react";
import { MaskedField } from "./MaskedField";
import {
  validarDemografico,
  type OrelhinhaItem,
  type DemograficoPayload,
  type CampoDemografico,
} from "../../lib/schemas/orelhinha";
import {
  maskCartaoSus,
  maskTelefone,
  maskData,
} from "../../lib/masks";

export interface EditSheetProps {
  item: OrelhinhaItem | null;
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (itemOriginal: OrelhinhaItem, payload: DemograficoPayload) => Promise<void>;
  permissoesCampos: string[];
  estaSalvando?: boolean;
}

export const EditSheet: React.FC<EditSheetProps> = ({
  item,
  aberto,
  onFechar,
  onSalvar,
  permissoesCampos,
  estaSalvando = false,
}) => {
  // Estado controlado dos campos demográficos editáveis
  const [cartaoSus, setCartaoSus] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erros, setErros] = useState<Partial<Record<CampoDemografico, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Inicializa os campos quando o item selecionado mudar
  useEffect(() => {
    if (item) {
      setCartaoSus(item.cartao_sus ? maskCartaoSus(item.cartao_sus) : "");
      setNomeMae(item.nome_mae ?? "");
      setMunicipio(item.municipio ?? "");
      setTelefone(item.telefone ? maskTelefone(item.telefone) : "");
      setErros({});
      setErroGeral(null);
    }
  }, [item]);

  // Fecha no Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto && !estaSalvando) {
        onFechar();
      }
    };
    if (aberto) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, estaSalvando, onFechar]);

  if (!aberto || !item) return null;

  const podeEditarCampo = (campo: string) => permissoesCampos.includes(campo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    // Valida apenas os campos que o usuário tem permissão para editar
    const camposParaValidar: Partial<Record<CampoDemografico, string>> = {};
    if (podeEditarCampo("cartao_sus")) camposParaValidar.cartao_sus = cartaoSus;
    if (podeEditarCampo("nome_mae")) camposParaValidar.nome_mae = nomeMae;
    if (podeEditarCampo("municipio")) camposParaValidar.municipio = municipio;
    if (podeEditarCampo("telefone")) camposParaValidar.telefone = telefone;

    const validacao = validarDemografico(camposParaValidar);
    if (!validacao.ok) {
      setErros(validacao.erros);
      return;
    }

    setErros({});

    try {
      await onSalvar(item, validacao.valor);
      onFechar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar alterações.";
      setErroGeral(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
      aria-labelledby="sheet-titulo"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Cabeçalho do Sheet */}
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Portaria & Serviço Social
              </span>
              <h2 id="sheet-titulo" className="text-[17px] font-semibold text-slate-900 mt-1.5">
                Atualizar Dados do Paciente
              </h2>
            </div>
            <button
              type="button"
              onClick={onFechar}
              disabled={estaSalvando}
              aria-label="Fechar painel"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contexto do Paciente (Nome e Leito) */}
          <div className="px-6 py-4 bg-slate-100/60 border-b border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-800 font-medium text-[15px]">
              <User className="w-4 h-4 text-slate-500" />
              <span>{item.nome_rn || "Recém-Nascido não identificado"}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[13px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Bed className="w-3.5 h-3.5 text-slate-400" />
                <span>Leito: {item.leito || "Sem leito"}</span>
              </span>
              <span>•</span>
              <span>
                Nasc: {item.data_nascimento ? maskData(item.data_nascimento) : "—"} (
                {item.sexo === "F" ? "Feminino" : item.sexo === "M" ? "Masculino" : "—"})
              </span>
            </div>
          </div>

          {/* Formulário Demográfico */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {erroGeral && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-[13px] text-rose-700">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{erroGeral}</span>
              </div>
            )}

            {/* Cartão SUS */}
            <MaskedField
              id="sheet-cartao-sus"
              label="Cartão SUS (CNS)"
              tipo="cartao_sus"
              value={cartaoSus}
              onChange={(v) => {
                setCartaoSus(v);
                if (erros.cartao_sus) setErros((prev) => ({ ...prev, cartao_sus: undefined }));
              }}
              error={erros.cartao_sus}
              readOnly={!podeEditarCampo("cartao_sus")}
              helperText="15 dígitos numéricos do SUS"
            />

            {/* Nome da Mãe */}
            <MaskedField
              id="sheet-nome-mae"
              label="Nome Completo da Mãe"
              tipo="texto"
              value={nomeMae}
              onChange={(v) => {
                setNomeMae(v);
                if (erros.nome_mae) setErros((prev) => ({ ...prev, nome_mae: undefined }));
              }}
              error={erros.nome_mae}
              readOnly={!podeEditarCampo("nome_mae")}
            />

            {/* Município */}
            <MaskedField
              id="sheet-municipio"
              label="Município de Residência"
              tipo="texto"
              value={municipio}
              onChange={(v) => {
                setMunicipio(v);
                if (erros.municipio) setErros((prev) => ({ ...prev, municipio: undefined }));
              }}
              error={erros.municipio}
              readOnly={!podeEditarCampo("municipio")}
            />

            {/* Telefone */}
            <MaskedField
              id="sheet-telefone"
              label="Telefone para Contato"
              tipo="telefone"
              value={telefone}
              onChange={(v) => {
                setTelefone(v);
                if (erros.telefone) setErros((prev) => ({ ...prev, telefone: undefined }));
              }}
              error={erros.telefone}
              readOnly={!podeEditarCampo("telefone")}
              helperText="Celular com 9 dígitos ou telefone fixo com DDD"
            />

            {/* Informativo de Auditoria */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-500">
              <p>
                <strong>Observação de Segurança:</strong> As alterações são registradas com autor, versão e data/hora. Caso o tablet esteja sem internet, a edição será salva offline e sincronizada assim que restabelecer sinal.
              </p>
            </div>
          </form>

          {/* Rodapé de Ações */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              disabled={estaSalvando}
              className="min-h-[44px] px-4 py-2 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={estaSalvando}
              className="min-h-[44px] px-5 py-2 text-[14px] font-medium text-white bg-sky-700 rounded-lg hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {estaSalvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Alterações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
