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
  Unlock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Search,
  Check,
  X,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  Baby,
  RefreshCw,
} from "lucide-react";
import {
  useOrelhinhaStore,
  ConsultaOrelhinhaItem,
} from "../context/OrelhinhaContext";
import {
  perfil_atual,
  canEditDataHora,
  canEditDemograficos,
  canCheckin,
  Perfil,
} from "../lib/perfil";
import {
  maskCartaoSUS,
  isValidSUS,
  maskDate,
  isValidDate,
  maskTime,
  isValidTime,
  maskPhone,
  isValidPhone,
} from "../utils/masks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

interface OrelhinhaTableProps {
  perfilProp?: Perfil;
  onRealizarExameClinico?: (consulta: ConsultaOrelhinhaItem) => void;
  titulo?: string;
  subtitulo?: string;
}

export default function OrelhinhaTable({
  perfilProp,
  onRealizarExameClinico,
  titulo = "Módulo Teste da Orelhinha",
  subtitulo = "Triagem Auditiva Neonatal Universal (EOA)",
}: OrelhinhaTableProps) {
  const {
    consultas,
    atualizarConsultaOrelhinha,
    realizarCheckin,
    sincronizarEmTempoReal,
  } = useOrelhinhaStore();

  // Determina perfil do operador atual de forma reativa
  const [perfil, setPerfil] = useState<Perfil>(() => perfilProp || perfil_atual());

  useEffect(() => {
    if (perfilProp) {
      setPerfil(perfilProp);
    } else {
      setPerfil(perfil_atual());
    }
  }, [perfilProp]);

  // Permissões baseadas em RBAC
  const fonoPodeEditarDataHora = canEditDataHora(perfil);
  const podeEditarDemograficos = canEditDemograficos(perfil);
  const podeFazerCheckin = canCheckin(perfil);

  // Estados de busca e filtros da tabela
  const [busca, setBusca] = useState("");
  const [filtroCheckin, setFiltroCheckin] = useState<"TODOS" | "CHECKIN_PENDENTE" | "CHECKIN_FEITO">("TODOS");

  // Estado do modal de edição (Inline / Minimalista)
  const [itemEmEdicao, setItemEmEdicao] = useState<ConsultaOrelhinhaItem | null>(null);
  const [formSus, setFormSus] = useState("");
  const [formDataNasc, setFormDataNasc] = useState("");
  const [formSexo, setFormSexo] = useState<"F" | "M">("F");
  const [formNomeMae, setFormNomeMae] = useState("");
  const [formMunicipio, setFormMunicipio] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formDataExame, setFormDataExame] = useState("");
  const [formHoraExame, setFormHoraExame] = useState("");

  // Feedback de erro e sucesso
  const [errosValidacao, setErrosValidacao] = useState<Record<string, string>>({});
  const [notificacao, setNotificacao] = useState<{ tipo: "sucesso" | "info" | "erro"; msg: string } | null>(null);

  const mostrarNotificacao = (tipo: "sucesso" | "info" | "erro", msg: string) => {
    setNotificacao({ tipo, msg });
    setTimeout(() => setNotificacao(null), 5000);
  };

  // Abre modal minimalista de edição com os dados formatados
  const abrirEdicao = (item: ConsultaOrelhinhaItem) => {
    setItemEmEdicao(item);
    setFormSus(maskCartaoSUS(item.cartaoSus || ""));
    setFormDataNasc(maskDate(item.dataNascimento || ""));
    setFormSexo(item.sexo || "F");
    setFormNomeMae(item.nomeMae || "");
    setFormMunicipio(item.municipio || "");
    setFormTelefone(maskPhone(item.telefone || ""));
    setFormDataExame(maskDate(item.data || ""));
    setFormHoraExame(maskTime(item.horario || ""));
    setErrosValidacao({});
  };

  // Salva edição respeitando estritamente o RBAC
  const handleSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEmEdicao) return;

    const novosErros: Record<string, string> = {};

    // 1. Validação Cartão SUS (15 dígitos)
    if (!isValidSUS(formSus)) {
      novosErros.sus = "Cartão SUS deve conter exatamente 15 dígitos numéricos.";
    }

    // 2. Validação Data de Nasc. (DD/MM/YYYY estrito)
    if (!isValidDate(formDataNasc)) {
      novosErros.dataNasc = "Data de nascimento inválida (use o formato DD/MM/AAAA válido).";
    }

    // 3. Validação Nome da Mãe
    if (!formNomeMae.trim()) {
      novosErros.nomeMae = "Nome da mãe é obrigatório.";
    }

    // 4. Validação Município
    if (!formMunicipio.trim()) {
      novosErros.municipio = "Município é obrigatório.";
    }

    // 5. Validação Telefone
    if (!isValidPhone(formTelefone)) {
      novosErros.telefone = "Telefone inválido (mínimo DDD + 8 ou 9 dígitos).";
    }

    // 6. Se Fonoaudiólogo alterou Data do Exame ou Hora, valida rigorosamente
    if (fonoPodeEditarDataHora) {
      if (!isValidDate(formDataExame)) {
        novosErros.dataExame = "Data do exame inválida (use formato DD/MM/AAAA válido).";
      }
      if (!isValidTime(formHoraExame)) {
        novosErros.horaExame = "Hora do exame inválida (use formato HH:mm válido entre 00:00 e 23:59).";
      }
    }

    if (Object.keys(novosErros).length > 0) {
      setErrosValidacao(novosErros);
      return;
    }

    // Prepara payload de atualização
    const payload: Partial<ConsultaOrelhinhaItem> = {
      cartaoSus: formSus,
      dataNascimento: formDataNasc,
      sexo: formSexo,
      nomeMae: formNomeMae.trim(),
      municipio: formMunicipio.trim(),
      telefone: formTelefone,
      responsavel: `${formNomeMae.trim()} (Mãe)`,
    };

    // RBAC CRÍTICO: apenas Fonoaudiólogo/Admin pode atualizar Data e Hora do Exame
    if (fonoPodeEditarDataHora) {
      payload.data = formDataExame;
      payload.horario = formHoraExame;
      payload.status = "Reagendado";
    }

    atualizarConsultaOrelhinha(itemEmEdicao.id, payload);
    setItemEmEdicao(null);
    mostrarNotificacao(
      "sucesso",
      fonoPodeEditarDataHora
        ? `Dados e agendamento de ${formNomeMae} atualizados com sucesso!`
        : `Dados demográficos de ${formNomeMae} atualizados com sucesso (Data/Hora preservadas).`
    );
  };

  // Realizar Check-in de chegada
  const handleCheckinClick = (id: number, nomeMae?: string) => {
    realizarCheckin(id);
    mostrarNotificacao("sucesso", `Check-in de ${nomeMae || "paciente"} registrado pela Portaria/Serviço Social.`);
  };

  // Lista filtrada
  const consultasFiltradas = useMemo(() => {
    return consultas.filter((item) => {
      const q = busca.toLowerCase().trim();
      const matchBusca =
        !q ||
        item.nomeMae?.toLowerCase().includes(q) ||
        item.cartaoSus?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        item.municipio?.toLowerCase().includes(q) ||
        item.paciente?.toLowerCase().includes(q) ||
        item.telefone?.includes(q);

      if (!matchBusca) return false;

      if (filtroCheckin === "CHECKIN_PENDENTE") return !item.checkinPortaria;
      if (filtroCheckin === "CHECKIN_FEITO") return Boolean(item.checkinPortaria);

      return true;
    });
  }, [consultas, busca, filtroCheckin]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Notificação flutuante */}
      {notificacao && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition-all shadow-xs animate-in fade-in ${
            notificacao.tipo === "sucesso"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : notificacao.tipo === "erro"
              ? "bg-rose-50 text-rose-900 border border-rose-200"
              : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {notificacao.msg}
          </span>
          <button
            onClick={() => setNotificacao(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header do Módulo: Clean & Hospitalar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Baby className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">{titulo}</h2>
              <p className="text-xs text-slate-500 font-medium">{subtitulo}</p>
            </div>
          </div>
        </div>

        {/* Indicador RBAC do Perfil Ativo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              fonoPodeEditarDataHora
                ? "bg-purple-50 text-purple-800 border-purple-200"
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            {fonoPodeEditarDataHora ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-purple-600" />
                <span>Perfil: Fonoaudiologia (Acesso Total: Data/Hora + Exame)</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Perfil: {perfil === "portaria" ? "Portaria" : "Serviço Social"} (Data/Hora Bloqueada)</span>
              </>
            )}
          </div>

          <button
            onClick={sincronizarEmTempoReal}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            title="Sincronizar em tempo real com Fonoaudiologia / Portaria"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Mãe, Cartão SUS, Município ou RN..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-purple-600 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFiltroCheckin("TODOS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroCheckin === "TODOS"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({consultas.length})
          </button>
          <button
            onClick={() => setFiltroCheckin("CHECKIN_PENDENTE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroCheckin === "CHECKIN_PENDENTE"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Aguardando Chegada ({consultas.filter((c) => !c.checkinPortaria).length})
          </button>
          <button
            onClick={() => setFiltroCheckin("CHECKIN_FEITO")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroCheckin === "CHECKIN_FEITO"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Check-in Concluído ({consultas.filter((c) => c.checkinPortaria).length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          TABELA DE DADOS HOSPITALAR (UI/UX CLEAN: SEM BORDAS EXCESSIVAS)
          ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3.5 px-4">Cartão SUS</th>
                <th className="py-3.5 px-3">Data Nasc.</th>
                <th className="py-3.5 px-2.5 text-center">Sexo</th>
                <th className="py-3.5 px-4">Nome da Mãe</th>
                <th className="py-3.5 px-3">Município</th>
                <th className="py-3.5 px-3">Telefone</th>
                <th className="py-3.5 px-3">
                  <div className="flex items-center gap-1">
                    <span>Data Exame</span>
                    {!fonoPodeEditarDataHora && (
                      <span title="Bloqueado para edição na Portaria/Social">
                        <Lock className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-3">
                  <div className="flex items-center gap-1">
                    <span>Hora</span>
                    {!fonoPodeEditarDataHora && (
                      <span title="Bloqueado para edição na Portaria/Social">
                        <Lock className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Check-in / Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {consultasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-medium">
                    Nenhum registro encontrado para a busca informada.
                  </td>
                </tr>
              ) : (
                consultasFiltradas.map((c) => {
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Cartão SUS: 000.0000.0000.0000 */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="bg-slate-100/90 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 text-xs">
                          {c.cartaoSus || "Não informado"}
                        </span>
                      </td>

                      {/* 2. Data de Nasc.: DD/MM/YYYY */}
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {c.dataNascimento}
                        </span>
                      </td>

                      {/* 3. Sexo: F / M */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {c.sexo === "F" ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            F
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                            M
                          </span>
                        )}
                      </td>

                      {/* 4. Nome da Mãe */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {c.nomeMae}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                            <span className="text-purple-700 font-semibold">{c.paciente}</span>
                            <span>•</span>
                            <span className="text-slate-500">{c.leito}</span>
                          </span>
                        </div>
                      </td>

                      {/* 5. Município */}
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {c.municipio}
                        </span>
                      </td>

                      {/* 6. Telefone: (00) 9.0000-0000 */}
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap font-mono text-xs">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          {c.telefone}
                        </span>
                      </td>

                      {/* 7. Data do Exame (Bloqueado para edição na Portaria) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {fonoPodeEditarDataHora ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-900 font-bold px-2.5 py-1 rounded-lg border border-purple-200 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            {c.data}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-xs select-none"
                            title="Alteração bloqueada na Portaria/Social. Somente Fonoaudiólogo(a) pode remarcar."
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            {c.data}
                          </span>
                        )}
                      </td>

                      {/* 8. Hora do Exame (Bloqueado para edição na Portaria) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {fonoPodeEditarDataHora ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-900 font-black px-2.5 py-1 rounded-lg border border-purple-200 text-xs">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            {c.horario}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-xs select-none"
                            title="Alteração bloqueada na Portaria/Social. Somente Fonoaudiólogo(a) pode remarcar."
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            {c.horario}
                          </span>
                        )}
                      </td>

                      {/* 9. Ações: Check-in / Edição Demográfica / Exame Clínico */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botão de Check-in (Portaria / Serviço Social) */}
                          {podeFazerCheckin && (
                            c.checkinPortaria ? (
                              <span
                                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold"
                                title={`Check-in realizado às ${c.checkinHorario || "horário confirmado"}`}
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Presente ({c.checkinHorario || "OK"})</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCheckinClick(c.id, c.nomeMae)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
                                title="Confirmar chegada da mãe na portaria"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Check-in</span>
                              </button>
                            )
                          )}

                          {/* Botão de Edição Demográfica / Data-Hora */}
                          <button
                            type="button"
                            onClick={() => abrirEdicao(c)}
                            className="p-1.5 text-slate-500 hover:text-purple-700 bg-slate-50 hover:bg-purple-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title={
                              fonoPodeEditarDataHora
                                ? "Editar agendamento e dados da mãe"
                                : "Editar dados demográficos (SUS, Mãe, Município, Telefone)"
                            }
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Se for Fonoaudiólogo, permite acionar parecer clínico diretamente */}
                          {fonoPodeEditarDataHora && onRealizarExameClinico && (
                            <button
                              type="button"
                              onClick={() => onRealizarExameClinico(c)}
                              className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                              title="Registrar Parecer Clínico EOA"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Exame</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL MINIMALISTA DE EDIÇÃO COM MÁSCARAS E RBAC RIGOROSO
          ========================================================================= */}
      <Dialog
        open={Boolean(itemEmEdicao)}
        onOpenChange={(open) => {
          if (!open) setItemEmEdicao(null);
        }}
      >
        <DialogContent className="max-w-lg bg-white rounded-3xl p-0 border-0 shadow-2xl overflow-hidden">
          {/* Header do Modal */}
          <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-6 text-white">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 text-purple-100 px-3 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Controle de Acesso (RBAC)
                </span>
                <span className="text-xs font-semibold text-purple-200">
                  ID #{itemEmEdicao?.id}
                </span>
              </div>
              <DialogTitle className="text-xl font-black text-white pt-1">
                {fonoPodeEditarDataHora
                  ? "Editar Agendamento & Dados do Paciente"
                  : "Atualizar Dados Demográficos (Portaria / Social)"}
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-xs">
                {fonoPodeEditarDataHora
                  ? "Permissão Fonoaudiológica ativa para alteração de Data, Hora e dados do RN."
                  : "Portaria e Serviço Social: Data e Hora do Exame são de leitura exclusiva."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Formulário com Máscaras Rigorosas */}
          <form onSubmit={handleSalvarEdicao} className="p-6 bg-slate-50 space-y-4">
            {/* Aviso de RBAC para Portaria */}
            {!fonoPodeEditarDataHora && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Campos <strong>Data</strong> e <strong>Hora do Exame</strong> estão bloqueados. Apenas a equipe de Fonoaudiologia pode remarcar exames.
                </span>
              </div>
            )}

            <div className="space-y-3.5">
              {/* 1. Cartão SUS (15 dígitos: 000.0000.0000.0000) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>1. Cartão SUS (15 dígitos) *</span>
                  <span className="text-[10px] text-slate-500 font-mono">000.0000.0000.0000</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formSus}
                    onChange={(e) => {
                      setFormSus(maskCartaoSUS(e.target.value));
                      if (errosValidacao.sus) setErrosValidacao((prev) => ({ ...prev, sus: "" }));
                    }}
                    placeholder="000.0000.0000.0000"
                    maxLength={18}
                    className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 outline-none transition-all ${
                      errosValidacao.sus ? "border-rose-500 bg-rose-50/30" : "border-slate-200 focus:border-purple-600"
                    }`}
                  />
                </div>
                {errosValidacao.sus && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.sus}</p>
                )}
              </div>

              {/* Linha com Data Nasc. e Sexo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2. Data de Nasc. (DD/MM/YYYY) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>2. Data de Nasc. *</span>
                    <span className="text-[10px] text-slate-500 font-mono">DD/MM/AAAA</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formDataNasc}
                      onChange={(e) => {
                        setFormDataNasc(maskDate(e.target.value));
                        if (errosValidacao.dataNasc) setErrosValidacao((prev) => ({ ...prev, dataNasc: "" }));
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all ${
                        errosValidacao.dataNasc ? "border-rose-500 bg-rose-50/30" : "border-slate-200 focus:border-purple-600"
                      }`}
                    />
                  </div>
                  {errosValidacao.dataNasc && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.dataNasc}</p>
                  )}
                </div>

                {/* 3. Sexo (F/M) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    3. Sexo *
                  </label>
                  <select
                    value={formSexo}
                    onChange={(e) => setFormSexo(e.target.value as "F" | "M")}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-purple-600"
                  >
                    <option value="F">Feminino (F)</option>
                    <option value="M">Masculino (M)</option>
                  </select>
                </div>
              </div>

              {/* 4. Nome da Mãe */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Nome da Mãe *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formNomeMae}
                    onChange={(e) => {
                      setFormNomeMae(e.target.value);
                      if (errosValidacao.nomeMae) setErrosValidacao((prev) => ({ ...prev, nomeMae: "" }));
                    }}
                    placeholder="Nome completo da genitora"
                    className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all ${
                      errosValidacao.nomeMae ? "border-rose-500" : "border-slate-200 focus:border-purple-600"
                    }`}
                  />
                </div>
                {errosValidacao.nomeMae && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.nomeMae}</p>
                )}
              </div>

              {/* Linha com Município e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 5. Município */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    5. Município *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formMunicipio}
                      onChange={(e) => {
                        setFormMunicipio(e.target.value);
                        if (errosValidacao.municipio) setErrosValidacao((prev) => ({ ...prev, municipio: "" }));
                      }}
                      placeholder="Ex: Arapiraca"
                      className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all ${
                        errosValidacao.municipio ? "border-rose-500" : "border-slate-200 focus:border-purple-600"
                      }`}
                    />
                  </div>
                  {errosValidacao.municipio && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.municipio}</p>
                  )}
                </div>

                {/* 6. Telefone: (00) 9.0000-0000 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>6. Telefone *</span>
                    <span className="text-[10px] text-slate-500 font-mono">(00) 9.0000-0000</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formTelefone}
                      onChange={(e) => {
                        setFormTelefone(maskPhone(e.target.value));
                        if (errosValidacao.telefone) setErrosValidacao((prev) => ({ ...prev, telefone: "" }));
                      }}
                      placeholder="(82) 9.8888-7777"
                      maxLength={16}
                      className={`w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 outline-none transition-all ${
                        errosValidacao.telefone ? "border-rose-500" : "border-slate-200 focus:border-purple-600"
                      }`}
                    />
                  </div>
                  {errosValidacao.telefone && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.telefone}</p>
                  )}
                </div>
              </div>

              {/* SEÇÃO CRÍTICA RBAC: 7. Data do Exame & 8. Hora do Exame */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    {fonoPodeEditarDataHora ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-purple-700" />
                        Agendamento do Exame (Fonoaudiologia)
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Agendamento do Exame (Somente Leitura)
                      </>
                    )}
                  </span>
                  {!fonoPodeEditarDataHora && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Bloqueado para Portaria/Social
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 7. Data do Exame */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      7. Data do Exame (DD/MM/AAAA)
                    </label>
                    <input
                      type="text"
                      disabled={!fonoPodeEditarDataHora}
                      value={formDataExame}
                      onChange={(e) => {
                        setFormDataExame(maskDate(e.target.value));
                        if (errosValidacao.dataExame) setErrosValidacao((prev) => ({ ...prev, dataExame: "" }));
                      }}
                      maxLength={10}
                      className={`w-full p-2.5 border rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        fonoPodeEditarDataHora
                          ? "bg-slate-50 border-purple-300 text-purple-900 focus:border-purple-600 focus:bg-white"
                          : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none"
                      }`}
                    />
                    {errosValidacao.dataExame && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.dataExame}</p>
                    )}
                  </div>

                  {/* 8. Hora do Exame */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      8. Hora do Exame (HH:mm)
                    </label>
                    <input
                      type="text"
                      disabled={!fonoPodeEditarDataHora}
                      value={formHoraExame}
                      onChange={(e) => {
                        setFormHoraExame(maskTime(e.target.value));
                        if (errosValidacao.horaExame) setErrosValidacao((prev) => ({ ...prev, horaExame: "" }));
                      }}
                      maxLength={5}
                      className={`w-full p-2.5 border rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        fonoPodeEditarDataHora
                          ? "bg-slate-50 border-purple-300 text-purple-900 focus:border-purple-600 focus:bg-white"
                          : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed select-none"
                      }`}
                    />
                    {errosValidacao.horaExame && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">{errosValidacao.horaExame}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações do Formulário */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setItemEmEdicao(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
