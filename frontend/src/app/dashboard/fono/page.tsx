"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import ErrorBoundary from "../../../components/ErrorBoundary";
import {
  Baby,
  Calendar,
  Clock,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  CalendarCheck,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Search,
  Sparkles,
  ShieldCheck,
  Bed,
  User,
  Activity,
  Heart,
  Lock
} from "lucide-react";
import AutoCompleteRNPaciente from "../../../components/AutoCompleteRNPaciente";
import { Paciente, fetchPacientes } from "../../../services/api";
import { useOrelhinhaStore } from "../../../context/OrelhinhaContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";

export interface ConsultaOrelhinha {
  id: number;
  paciente: string;
  leito: string;
  responsavel: string;
  data: string;
  horario: string;
  status: "Agendado" | "Realizado" | "Reagendado" | "Cancelado" | "Falha / Re-teste" | "Ausente";
  presenca?: "Presente" | "Ausente" | "Pendente";
  resultadoGeral?: "Passou (Normal bilateral)" | "Falha (Re-teste 30 dias)" | "Ausente / Não Realizado" | "Inconclusivo (Vernix / Ruído)";
  orelhaDireita?: "Passou" | "Falhou";
  orelhaEsquerda?: "Passou" | "Falhou";
  indicadoresRisco?: string[];
  observacoes?: string;
  conduta?: string;
  fonoaudiologo?: string;
  crfa?: string;
  dataRegistro?: string;
}

const CONSULTAS_PADRAO: ConsultaOrelhinha[] = [
  {
    id: 1,
    paciente: "RN de Maria Eduarda",
    leito: "Maternidade 03",
    responsavel: "Maria Eduarda (Mãe)",
    data: "2026-10-24",
    horario: "09:00",
    status: "Agendado",
    presenca: "Pendente",
    observacoes: "Recém-nascido a termo, 39 semanas, parto normal.",
  },
  {
    id: 2,
    paciente: "RN de Camila Santos",
    leito: "Berçário 02",
    responsavel: "Lucas Santos (Pai)",
    data: "2026-10-24",
    horario: "10:30",
    status: "Agendado",
    presenca: "Pendente",
    observacoes: "Aguardando despertar para realização do teste.",
  },
  {
    id: 3,
    paciente: "RN de Beatriz Lima",
    leito: "Maternidade 07",
    responsavel: "Beatriz Lima (Mãe)",
    data: "2026-10-24",
    horario: "14:00",
    status: "Realizado",
    presenca: "Presente",
    resultadoGeral: "Passou (Normal bilateral)",
    orelhaDireita: "Passou",
    orelhaEsquerda: "Passou",
    fonoaudiologo: "Dra. Juliana Fonoaudióloga",
    crfa: "CRFa 4-8921",
    dataRegistro: "24/10/2026 14:22",
    conduta: "Alta da triagem auditiva neonatal com orientações aos pais.",
    observacoes: "EOA presentes e reprodutíveis bilateralmente em ambiente silencioso.",
  },
  {
    id: 4,
    paciente: "RN de Juliana Costa",
    leito: "Berçário 04",
    responsavel: "Juliana Costa (Mãe)",
    data: "2026-10-25",
    horario: "08:30",
    status: "Agendado",
    presenca: "Pendente",
    observacoes: "Sem intercorrências no parto.",
  },
  {
    id: 5,
    paciente: "RN de Sandra Liberal",
    leito: "Maternidade 01",
    responsavel: "Sandra Liberal (Mãe)",
    data: "2026-10-24",
    horario: "11:15",
    status: "Agendado",
    presenca: "Pendente",
    observacoes: "Encaminhada pela equipe da maternidade para triagem auditiva.",
  },
];

const OPCOES_RISCO = [
  "Histórico familiar de perda auditiva congênita",
  "Permanência em UTI Neonatal > 5 dias",
  "Infecções congênitas (Toxoplasmose, Rubéola, CMV, Herpes, Sífilis)",
  "Prematuridade (Idade Gestacional < 37 semanas) ou Baixo Peso (<1500g)",
  "Hiperbilirrubinemia grave / Exsanguinotransfusão",
  "Uso de medicação ototóxica (Aminoglicosídeos / Diuréticos de alça)",
  "Anomalias craniofaciais envolvendo pavilhão e meato acústico",
];

function FonoDashboardContent() {
  const {
    consultas,
    adicionarConsultaOrelhinha,
    atualizarConsultaOrelhinha,
    removerConsultaOrelhinha,
  } = useOrelhinhaStore();

  // Filtros e busca
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "AGENDADOS" | "REALIZADOS" | "FALHAS">("TODOS");

  // Edição inline rápida de data/horário
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  // Modal de Adicionar Novo Agendamento
  const [isModalNovoOpen, setIsModalNovoOpen] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [pacientesCadastrados, setPacientesCadastrados] = useState<Paciente[]>([]);
  const [novoPaciente, setNovoPaciente] = useState("");
  const [novoLeito, setNovoLeito] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [novaData, setNovaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [novoHorario, setNovoHorario] = useState("09:00");
  const [novaObservacao, setNovaObservacao] = useState("");

  useEffect(() => {
    let ativo = true;
    fetchPacientes().then((res) => {
      if (ativo && Array.isArray(res)) setPacientesCadastrados(res);
    }).catch((err) => console.error("Erro ao carregar pacientes:", err));
    return () => { ativo = false; };
  }, []);

  // Popula o campo LEITO/SETOR via onChange do campo 'Recém-Nascido'
  const handlePacienteRNChange = (val: string) => {
    setNovoPaciente(val);
    if (!val || !val.trim()) {
      setNovoLeito("");
      setPacienteSelecionado(null);
      return;
    }
    const q = val.toLowerCase().trim();
    const encontrado = pacientesCadastrados.find((p) => {
      const mae = p.nome_mae || (p as unknown as { nomeMae?: string }).nomeMae || "";
      return (
        p.usuario_nome?.toLowerCase().includes(q) ||
        mae.toLowerCase().includes(q) ||
        p.leito?.toLowerCase().includes(q)
      );
    });

    if (encontrado) {
      setNovoLeito(encontrado.leito || encontrado.setor_clinica || "");
      setPacienteSelecionado(encontrado);
      const mae = encontrado.nome_mae || (encontrado as unknown as { nomeMae?: string }).nomeMae;
      if (mae) {
        setNovoResponsavel(`${mae} (Mãe)`);
      } else if (encontrado.acompanhante_nome) {
        setNovoResponsavel(`${encontrado.acompanhante_nome} (Acompanhante)`);
      }
    }
  };

  const handleSelectPacienteRN = (paciente: Paciente) => {
    setPacienteSelecionado(paciente);
    setNovoPaciente(paciente.usuario_nome);
    setNovoLeito(paciente.leito || paciente.setor_clinica || "");

    const mae = paciente.nome_mae || (paciente as unknown as { nomeMae?: string }).nomeMae;
    if (mae) {
      setNovoResponsavel(`${mae} (Mãe)`);
    } else if (paciente.acompanhante_nome) {
      setNovoResponsavel(`${paciente.acompanhante_nome} (Acompanhante)`);
    }
  };

  const handleClearPacienteRN = () => {
    setPacienteSelecionado(null);
    setNovoPaciente("");
    setNovoLeito("");
    setNovoResponsavel("");
  };

  // Modal de Formulário Clínico do Exame
  const [isModalClinicoOpen, setIsModalClinicoOpen] = useState(false);
  const [pacienteExame, setPacienteExame] = useState<ConsultaOrelhinha | null>(null);
  const [presenca, setPresenca] = useState<"Presente" | "Ausente">("Presente");
  const [orelhaDireita, setOrelhaDireita] = useState<"Passou" | "Falhou">("Passou");
  const [orelhaEsquerda, setOrelhaEsquerda] = useState<"Passou" | "Falhou">("Passou");
  const [resultadoGeral, setResultadoGeral] = useState<string>("Passou (Normal bilateral)");
  const [indicadoresSelecionados, setIndicadoresSelecionados] = useState<string[]>([]);
  const [conduta, setConduta] = useState("Alta da triagem auditiva neonatal com orientações aos pais.");
  const [observacoesClinicas, setObservacoesClinicas] = useState("");
  const [fonoaudiologoNome, setFonoaudiologoNome] = useState("Dra. Juliana Ribeiro");
  const [crfa, setCrfa] = useState("CRFa 4-8921");

  // Atualiza resultado geral automaticamente com base no teste das orelhas quando presença for Presente
  const handleMudarOrelha = (orelha: "OD" | "OE", resultado: "Passou" | "Falhou") => {
    const novaOD = orelha === "OD" ? resultado : orelhaDireita;
    const novaOE = orelha === "OE" ? resultado : orelhaEsquerda;

    if (orelha === "OD") setOrelhaDireita(resultado);
    if (orelha === "OE") setOrelhaEsquerda(resultado);

    if (novaOD === "Passou" && novaOE === "Passou") {
      setResultadoGeral("Passou (Normal bilateral)");
      setConduta("Alta da triagem auditiva neonatal com orientações aos pais.");
    } else {
      setResultadoGeral("Falha (Re-teste 30 dias)");
      setConduta("Reagendamento de re-teste em 30 dias para confirmação dos achados auditivos.");
    }
  };

  const abrirModalClinico = (c: ConsultaOrelhinha) => {
    setPacienteExame(c);
    setPresenca(c.presenca === "Ausente" ? "Ausente" : "Presente");
    setOrelhaDireita(c.orelhaDireita || "Passou");
    setOrelhaEsquerda(c.orelhaEsquerda || "Passou");
    setResultadoGeral(c.resultadoGeral || (c.status === "Realizado" ? "Passou (Normal bilateral)" : "Passou (Normal bilateral)"));
    setIndicadoresSelecionados(c.indicadoresRisco || []);
    setConduta(c.conduta || "Alta da triagem auditiva neonatal com orientações aos pais.");
    setObservacoesClinicas(c.observacoes || "");
    setFonoaudiologoNome(c.fonoaudiologo || "Dra. Juliana Ribeiro");
    setCrfa(c.crfa || "CRFa 4-8921");
    setIsModalClinicoOpen(true);
  };

  const handleSalvarExameClinico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteExame) return;

    let novoStatus: ConsultaOrelhinha["status"] = "Realizado";
    let resultadoFinal = resultadoGeral;

    if (presenca === "Ausente") {
      novoStatus = "Ausente";
      resultadoFinal = "Ausente / Não Realizado";
    } else if (resultadoGeral.includes("Falha") || orelhaDireita === "Falhou" || orelhaEsquerda === "Falhou") {
      novoStatus = "Falha / Re-teste";
    } else {
      novoStatus = "Realizado";
    }

    const agora = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    atualizarConsultaOrelhinha(pacienteExame.id, {
      status: novoStatus,
      presenca,
      resultadoGeral: resultadoFinal as ConsultaOrelhinha["resultadoGeral"],
      orelhaDireita: presenca === "Presente" ? orelhaDireita : undefined,
      orelhaEsquerda: presenca === "Presente" ? orelhaEsquerda : undefined,
      indicadoresRisco: indicadoresSelecionados,
      observacoes: observacoesClinicas.trim(),
      conduta: conduta.trim(),
      fonoaudiologo: fonoaudiologoNome.trim(),
      crfa: crfa.trim(),
      dataRegistro: agora,
    });

    setIsModalClinicoOpen(false);
    setMensagemSucesso(`Registro clínico de ${pacienteExame.paciente} salvo com sucesso! Status: ${novoStatus}.`);
    setTimeout(() => setMensagemSucesso(""), 6000);
  };

  // Manipulação de indicadores de risco
  const toggleIndicador = (item: string) => {
    setIndicadoresSelecionados((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Edição rápida de data/hora
  const handleStartEdit = (c: ConsultaOrelhinha) => {
    setEditingId(c.id);
    setEditData(c.data);
    setEditHorario(c.horario);
  };

  const handleSaveEdit = (id: number) => {
    atualizarConsultaOrelhinha(id, {
      data: editData,
      horario: editHorario,
      status: "Reagendado",
    });
    setEditingId(null);
    setMensagemSucesso(`Horário da consulta #${id} reagendado com sucesso!`);
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const handleAdicionarConsulta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPaciente.trim() || !novaData || !novoHorario) return;

    const novaConsulta = adicionarConsultaOrelhinha({
      paciente: novoPaciente.trim(),
      leito: novoLeito.trim() || "Maternidade",
      responsavel: novoResponsavel.trim() || "Mãe/Responsável",
      data: novaData,
      horario: novoHorario,
      status: "Agendado",
      presenca: "Pendente",
      observacoes: novaObservacao.trim(),
    });

    setIsModalNovoOpen(false);

    setNovoPaciente("");
    setNovoLeito("");
    setNovoResponsavel("");
    setNovaObservacao("");
    setPacienteSelecionado(null);
    setMensagemSucesso(`Novo agendamento criado para ${novaConsulta.paciente}!`);
    setTimeout(() => setMensagemSucesso(""), 5000);
  };

  const handleExcluirConsulta = (id: number) => {
    if (confirm("Deseja realmente remover este agendamento?")) {
      removerConsultaOrelhinha(id);
      setMensagemSucesso(`Agendamento #${id} removido.`);
      setTimeout(() => setMensagemSucesso(""), 3000);
    }
  };

  // Consultas filtradas
  const consultasFiltradas = useMemo(() => {
    return consultas.filter((c) => {
      const matchBusca =
        c.paciente.toLowerCase().includes(termoBusca.toLowerCase()) ||
        c.leito.toLowerCase().includes(termoBusca.toLowerCase()) ||
        c.responsavel.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;

      if (filtroStatus === "AGENDADOS") return c.status === "Agendado" || c.status === "Reagendado";
      if (filtroStatus === "REALIZADOS") return c.status === "Realizado";
      if (filtroStatus === "FALHAS") return c.status === "Falha / Re-teste";

      return true;
    });
  }, [consultas, termoBusca, filtroStatus]);

  // Contadores para métricas
  const totalAgendados = consultas.filter((c) => c.status === "Agendado" || c.status === "Reagendado").length;
  const totalRealizados = consultas.filter((c) => c.status === "Realizado").length;
  const totalFalhas = consultas.filter((c) => c.status === "Falha / Re-teste").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      {/* =========================================================================
          MODAL CLÍNICO: REGISTRO DE PRESENÇA E RESULTADO DO EXAME (FONOAUDIOLOGIA)
          ========================================================================= */}
      <Dialog open={isModalClinicoOpen} onOpenChange={setIsModalClinicoOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-0 border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 p-6 text-white sticky top-0 z-10">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider bg-white/20 text-purple-100 px-3 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" /> Prontuário Clínico Neonatal
                </span>
                <span className="text-xs font-semibold text-purple-200">
                  Triagem Auditiva (EOA)
                </span>
              </div>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-2 pt-1">
                <Baby className="w-6 h-6 text-purple-300" />
                Resultado do Teste da Orelhinha
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-xs sm:text-sm">
                Registro oficial de presença, emissões otoacústicas evocadas e conduta audiológica.
              </DialogDescription>
            </DialogHeader>
          </div>

          {pacienteExame && (
            <form onSubmit={handleSalvarExameClinico} className="p-6 bg-slate-50 space-y-5">
              {/* Card Resumo do Paciente */}
              <div className="p-4 bg-white rounded-2xl border border-purple-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-black text-lg border border-purple-200 shrink-0">
                    <Baby className="w-6 h-6 text-purple-700" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">{pacienteExame.paciente}</h4>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                      <span>Mãe/Resp: <strong className="text-slate-700">{pacienteExame.responsavel}</strong></span>
                      <span>•</span>
                      <span className="text-purple-700 font-bold">{pacienteExame.leito}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-500 block">Agendado para:</span>
                  <span className="text-xs font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    {pacienteExame.data} às {pacienteExame.horario}
                  </span>
                </div>
              </div>

              {/* SEÇÃO 1: Presença do Paciente */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-purple-700" />
                  1. Confirmação de Presença
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPresenca("Presente")}
                    className={`p-3.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      presenca === "Presente"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${presenca === "Presente" ? "text-emerald-600" : "text-slate-400"}`} />
                    <span>Compareceu (Presente)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPresenca("Ausente");
                      setResultadoGeral("Ausente / Não Realizado");
                    }}
                    className={`p-3.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      presenca === "Ausente"
                        ? "border-red-500 bg-red-50 text-red-900 shadow-xs"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <XCircle className={`w-5 h-5 ${presenca === "Ausente" ? "text-red-600" : "text-slate-400"}`} />
                    <span>Ausente / Faltou</span>
                  </button>
                </div>
              </div>

              {/* SEÇÃO 2: Avaliação por Orelha (Somente se Presente) */}
              {presenca === "Presente" && (
                <>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-purple-700" />
                      2. Emissões Otoacústicas Evocadas (EOA) por Orelha
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Orelha Direita */}
                      <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-purple-900 uppercase">Orelha Direita (OD)</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            orelhaDireita === "Passou" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {orelhaDireita}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleMudarOrelha("OD", "Passou")}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              orelhaDireita === "Passou"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ✓ Passou
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMudarOrelha("OD", "Falhou")}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              orelhaDireita === "Falhou"
                                ? "bg-red-600 text-white shadow-xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ✕ Falhou
                          </button>
                        </div>
                      </div>

                      {/* Orelha Esquerda */}
                      <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-900 uppercase">Orelha Esquerda (OE)</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            orelhaEsquerda === "Passou" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {orelhaEsquerda}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleMudarOrelha("OE", "Passou")}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              orelhaEsquerda === "Passou"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ✓ Passou
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMudarOrelha("OE", "Falhou")}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              orelhaEsquerda === "Falhou"
                                ? "bg-red-600 text-white shadow-xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ✕ Falhou
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 3: Parecer e Conduta Clínica */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-purple-700" />
                      3. Parecer Geral & Conduta
                    </label>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Resultado Geral da Triagem:
                      </label>
                      <select
                        value={resultadoGeral}
                        onChange={(e) => setResultadoGeral(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold text-sm outline-none focus:border-purple-600 focus:bg-white transition-all shadow-2xs"
                      >
                        <option value="Passou (Normal bilateral)">Passou (Normal bilateral)</option>
                        <option value="Falha (Re-teste 30 dias)">Falha (Re-teste necessário em até 30 dias)</option>
                        <option value="Inconclusivo (Vernix / Ruído)">Inconclusivo (Vernix no conduto / Ruído ambiental)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Conduta Fonoaudiológica Recomendada:
                      </label>
                      <input
                        type="text"
                        value={conduta}
                        onChange={(e) => setConduta(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs sm:text-sm outline-none focus:border-purple-600 focus:bg-white transition-all shadow-2xs"
                        placeholder="Ex: Alta da triagem auditiva com orientações de marcos do desenvolvimento..."
                      />
                    </div>
                  </div>

                  {/* SEÇÃO 4: Indicadores de Risco Auditivo (IRDA) */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      4. Indicadores de Risco para Deficiência Auditiva (IRDA)
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {OPCOES_RISCO.map((risco, idx) => {
                        const marcado = indicadoresSelecionados.includes(risco);
                        return (
                          <label
                            key={idx}
                            onClick={() => toggleIndicador(risco)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              marcado ? "bg-purple-50 text-purple-900 font-bold" : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => {}}
                              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                            />
                            <span>{risco}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* SEÇÃO 5: Observações Clínicas Adicionais */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-700" />
                      5. Observações Clínicas e Comportamentais
                    </label>
                    <textarea
                      rows={2}
                      value={observacoesClinicas}
                      onChange={(e) => setObservacoesClinicas(e.target.value)}
                      placeholder="Observações do exame (ex: estado de vigília do RN, presença de vernix, ruído ambiental, cooperação da mãe)..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs sm:text-sm outline-none focus:border-purple-600 focus:bg-white transition-all shadow-2xs"
                    />
                  </div>
                </>
              )}

              {/* SEÇÃO 6: Identificação do(a) Profissional */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fonoaudiólogo(a) Examinador(a) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fonoaudiologoNome}
                    onChange={(e) => setFonoaudiologoNome(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold outline-none focus:border-purple-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registro Profissional (CRFa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={crfa}
                    onChange={(e) => setCrfa(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold outline-none focus:border-purple-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalClinicoOpen(false)}
                  className="px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-black text-white bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Registro Clínico</span>
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL: ADICIONAR NOVO AGENDAMENTO DE TESTE DA ORELHINHA
          ========================================================================= */}
      <Dialog open={isModalNovoOpen} onOpenChange={(open) => {
        setIsModalNovoOpen(open);
        if (!open) handleClearPacienteRN();
      }}>
        <DialogContent className="max-w-xl bg-white rounded-3xl p-0 overflow-visible border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-purple-700 to-indigo-800 p-6 text-white rounded-t-3xl">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-6 h-6 text-purple-300" />
                Agendar Teste da Orelhinha
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-sm">
                Cadastre a data, horário e os dados do recém-nascido para agendamento da triagem neonatal.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleAdicionarConsulta} className="p-6 bg-slate-50 space-y-4 rounded-b-3xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Recém-Nascido / Paciente *</span>
                {pacienteSelecionado && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paciente Internado Selecionado
                  </span>
                )}
              </label>
              <AutoCompleteRNPaciente
                value={novoPaciente}
                onChangeValue={handlePacienteRNChange}
                onSelect={handleSelectPacienteRN}
                onClear={handleClearPacienteRN}
                placeholder="Busca unificada: digite nome do RN, mãe ou leito..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>LEITO/SETOR</span>
                  <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-purple-200">
                    <Lock className="w-3 h-3" /> Preenchido Automático
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Preenchido via seleção do Recém-Nascido"
                  value={novoLeito}
                  readOnly={true}
                  className="w-full p-3.5 border rounded-xl font-medium text-sm transition-all shadow-2xs bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Mãe ou Responsável</span>
                  {pacienteSelecionado && novoResponsavel && (
                    <span className="text-[10px] text-pink-700 font-bold bg-pink-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-pink-200">
                      Automático
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mariana Silva (Mãe)"
                  value={novoResponsavel}
                  onChange={(e) => setNovoResponsavel(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 font-medium text-sm transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Data da Consulta *
                </label>
                <input
                  type="date"
                  required
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 font-medium text-sm transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Horário *
                </label>
                <input
                  type="time"
                  required
                  value={novoHorario}
                  onChange={(e) => setNovoHorario(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 font-medium text-sm transition-all shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Observações Clínicas Iniciais
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Bebê em aleitamento materno exclusivo..."
                value={novaObservacao}
                onChange={(e) => setNovaObservacao(e.target.value)}
                className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 font-medium text-sm transition-all shadow-2xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalNovoOpen(false)}
                className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-800 bg-white border rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Salvar Agendamento
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          CABEÇALHO DA TELA DE FONOAUDIOLOGIA
          ========================================================================= */}
      <header className="w-full bg-white border-b-4 border-purple-700 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center p-2 shadow-2xs border border-purple-200">
            <Baby className="w-8 h-8 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fonoaudiologia — Teste da Orelhinha</h1>
              <span className="bg-purple-100 text-purple-800 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Módulo Clínico
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Triagem Auditiva Neonatal Universal (EOA) • Hospital Regional Nossa Senhora do Bom Conselho
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsModalNovoOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
          <Link
            href="/dashboard/portaria"
            className="text-xs sm:text-sm font-bold text-primary-blue hover:bg-blue-50 transition-colors px-3.5 py-2.5 border border-blue-200 rounded-xl"
          >
            Portaria
          </Link>
          <Link
            href="/"
            className="text-xs sm:text-sm font-bold text-gray-600 hover:text-purple-700 transition-colors px-3.5 py-2.5 border rounded-xl"
          >
            Painel Geral
          </Link>
        </div>
      </header>

      {/* =========================================================================
          CONTEÚDO PRINCIPAL
          ========================================================================= */}
      <main className="flex-1 w-full max-w-7xl p-6 flex flex-col gap-6">
        {/* Banner de Boas-vindas e Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Agendados Hoje</span>
              <span className="text-2xl font-black text-slate-800">{totalAgendados}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Exames Concluídos</span>
              <span className="text-2xl font-black text-emerald-800">{totalRealizados}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Re-testes / Falhas</span>
              <span className="text-2xl font-black text-amber-800">{totalFalhas}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-700 to-indigo-800 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">Fluxo Clínico</span>
              <span className="text-sm font-black">Isolado da Portaria</span>
              <p className="text-[11px] text-purple-200 mt-0.5">Sem consumo de cota social</p>
            </div>
            <Sparkles className="w-7 h-7 text-purple-300 opacity-90" />
          </div>
        </div>

        {mensagemSucesso && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 rounded-r-2xl font-medium text-sm animate-in fade-in flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {mensagemSucesso}
            </span>
            <button onClick={() => setMensagemSucesso("")} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabela de Pacientes Agendados e Registro Clínico */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
          {/* Barra de Filtros e Busca */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por recém-nascido, leito ou responsável..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-purple-600 shadow-2xs transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setFiltroStatus("TODOS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroStatus === "TODOS"
                    ? "bg-purple-700 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Todos ({consultas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("AGENDADOS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroStatus === "AGENDADOS"
                    ? "bg-purple-700 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Agendados ({totalAgendados})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("REALIZADOS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroStatus === "REALIZADOS"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Concluídos ({totalRealizados})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("FALHAS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroStatus === "FALHAS"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Falhas ({totalFalhas})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200/80">
                  <th className="p-4 font-bold">Recém-Nascido / Paciente</th>
                  <th className="p-4 font-bold">Leito</th>
                  <th className="p-4 font-bold">Responsável</th>
                  <th className="p-4 font-bold">Data & Horário</th>
                  <th className="p-4 font-bold">Status Clínico</th>
                  <th className="p-4 font-bold">Resultado EOA</th>
                  <th className="p-4 font-bold text-center">Ação Clínica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {consultasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                      Nenhum agendamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  consultasFiltradas.map((c) => {
                    const isEditing = editingId === c.id;
                    const temResultado = Boolean(c.resultadoGeral);

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-purple-50/50 transition-colors cursor-pointer group"
                        onClick={(e) => {
                          // Se o clique foi no input de editar horário ou botão de excluir, não abre modal
                          const target = e.target as HTMLElement;
                          if (target.closest("button") || target.closest("input")) return;
                          abrirModalClinico(c);
                        }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 group-hover:scale-125 transition-transform" />
                            <div>
                              <span className="font-extrabold text-slate-900 block group-hover:text-purple-700 transition-colors">
                                {c.paciente}
                              </span>
                              {c.observacoes && (
                                <span className="text-[11px] text-slate-500 block line-clamp-1 italic">
                                  {c.observacoes}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                            <Bed className="w-3 h-3 text-purple-600" />
                            {c.leito}
                          </span>
                        </td>

                        <td className="p-4 text-xs font-medium text-slate-600">
                          {c.responsavel}
                        </td>

                        <td className="p-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={editData}
                                onChange={(e) => setEditData(e.target.value)}
                                className="p-1 border border-purple-400 rounded text-xs font-bold outline-none bg-white"
                              />
                              <input
                                type="time"
                                value={editHorario}
                                onChange={(e) => setEditHorario(e.target.value)}
                                className="p-1 border border-purple-400 rounded text-xs font-bold outline-none bg-white"
                              />
                              <button
                                onClick={() => handleSaveEdit(c.id)}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                title="Confirmar novo horário"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-purple-600" />
                                  {c.data}
                                </span>
                                <span className="text-[11px] text-purple-900 font-black flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-purple-600" />
                                  {c.horario}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(c);
                                }}
                                className="text-slate-400 hover:text-purple-700 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Reagendar data e horário"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 border ${
                              c.status === "Realizado"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : c.status === "Falha / Re-teste"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : c.status === "Ausente"
                                ? "bg-red-50 text-red-800 border-red-300"
                                : "bg-purple-50 text-purple-800 border-purple-200"
                            }`}
                          >
                            {c.status === "Realizado" && <CheckCircle2 className="w-3 h-3" />}
                            {c.status === "Falha / Re-teste" && <AlertTriangle className="w-3 h-3" />}
                            {c.status}
                          </span>
                        </td>

                        <td className="p-4">
                          {temResultado ? (
                            <div className="text-xs">
                              <span className="font-extrabold text-slate-800 block">
                                {c.resultadoGeral}
                              </span>
                              {c.orelhaDireita && c.orelhaEsquerda && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  OD: <strong>{c.orelhaDireita}</strong> | OE: <strong>{c.orelhaEsquerda}</strong>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic font-medium">
                              Aguardando exame
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirModalClinico(c)}
                              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                              title="Abrir prontuário clínico para registrar presença e resultado do exame"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              <span>{temResultado ? "Ver / Editar Exame" : "Registrar Exame"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExcluirConsulta(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Remover agendamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      </main>
    </div>
  );
}

export default function FonoDashboardPage() {
  return (
    <ErrorBoundary fallbackTitle="Erro no Painel de Fonoaudiologia">
      <FonoDashboardContent />
    </ErrorBoundary>
  );
}
