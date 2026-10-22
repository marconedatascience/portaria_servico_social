"use client";

import React, { useState, useEffect } from "react";
import CheckInAssistidoModal from "../components/CheckInAssistidoModal";
import TabelaServicoSocial from "../components/TabelaServicoSocial";
import AutoCompletePaciente from "../components/AutoCompletePaciente";
import { 
  fetchPacientes, 
  fetchRegras, 
  desocuparVisitante, 
  confirmarAltaHospitalar, 
  Paciente 
} from "../services/api";
import { supabase } from "../lib/supabase";
import { perfilDaSessao, rotaInicialDoPerfil } from "../lib/perfil";
import AcessoPendente from "../components/AcessoPendente";
import ErrorBoundary from "../components/ErrorBoundary";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  UserPlus, 
  LogOut, 
  Clock, 
  UserMinus, 
  Shield, 
  Baby, 
  FileSpreadsheet, 
  Bed, 
  Users, 
  UserCheck, 
  Activity, 
  HeartHandshake, 
  ArrowLeftRight,
  RefreshCw,
  AlertTriangle,
  DoorOpen
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

function DashboardContent() {
  const [isModalCheckInOpen, setIsModalCheckInOpen] = useState(false);
  const [modalTipoInicial, setModalTipoInicial] = useState<'visitante' | 'acompanhante' | undefined>(undefined);
  const [autenticado, setAutenticado] = useState(false);
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [usuarioRole, setUsuarioRole] = useState<string | null>(null);
  const [pacienteFocado, setPacienteFocado] = useState<Paciente | null>(null);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroSetor, setFiltroSetor] = useState<string>("TODOS");
  const [abaAtiva, setAbaAtiva] = useState<"geral" | "servico_social">("geral");

  // Estado para Modal de Confirmação de Alta
  const [pacienteParaAlta, setPacienteParaAlta] = useState<Paciente | null>(null);
  const [isConfirmandoAlta, setIsConfirmandoAlta] = useState(false);
  const [obsAlta, setObsAlta] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const queryClient = useQueryClient();

  const { data: pacientes = [], isLoading: loading, isFetching, refetch } = useQuery({
    queryKey: ["pacientes"],
    queryFn: fetchPacientes,
    enabled: autenticado,
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["regras"],
    queryFn: fetchRegras,
    enabled: autenticado,
  });

  // Proteção de rota por perfil JWT
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setUsuarioEmail(session.user.email ?? "");

      const perfil = perfilDaSessao(session);
      setUsuarioRole(perfil);
      if (!perfil) {
        setAguardandoAprovacao(true);
        return;
      }
      if (rotaInicialDoPerfil(perfil) !== "/") {
        window.location.replace(rotaInicialDoPerfil(perfil));
        return;
      }
      setAutenticado(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, []);

  const sair = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const handleOpenCheckIn = (paciente: Paciente, tipo?: 'visitante' | 'acompanhante') => {
    setPacienteFocado(paciente);
    setModalTipoInicial(tipo);
    setIsModalCheckInOpen(true);
  };

  const handleConfirmarAlta = async () => {
    if (!pacienteParaAlta) return;
    setIsConfirmandoAlta(true);
    try {
      const res = await confirmarAltaHospitalar(pacienteParaAlta.id, obsAlta.trim());
      setMensagemSucesso(`Alta confirmada com sucesso! Leito ${res.leito_liberado || pacienteParaAlta.leito} liberado.`);
      setPacienteParaAlta(null);
      setObsAlta("");
      if (pacienteFocado?.id === pacienteParaAlta.id) {
        setPacienteFocado(null);
      }
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setTimeout(() => setMensagemSucesso(""), 6000);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erro ao confirmar alta.");
    } finally {
      setIsConfirmandoAlta(false);
    }
  };

  const handleSaidaVisitante = async (pacienteId: number) => {
    if (confirm("Deseja registrar a saída do visitante ativo deste leito?")) {
      try {
        await desocuparVisitante(pacienteId);
        setMensagemSucesso("Saída do visitante registrada com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["pacientes"] });
        setTimeout(() => setMensagemSucesso(""), 4000);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Erro ao registrar saída.");
      }
    }
  };

  // Filtragem dos pacientes internados
  const pacientesFiltrados = pacientes.filter((p) => {
    // Esconde por padrão pacientes em alta, a menos que pesquisados explicitamente
    const estaInternado = p.status_internacao !== "ALTA";
    
    // Filtro por setor
    if (filtroSetor === "VERMELHA") {
      const isVermelha = p.setor_clinica?.toLowerCase().includes("vermelh") || p.leito?.toLowerCase().includes("vermelh");
      if (!isVermelha) return false;
    } else if (filtroSetor === "CLINICAS") {
      const isVermelha = p.setor_clinica?.toLowerCase().includes("vermelh") || p.leito?.toLowerCase().includes("vermelh");
      if (isVermelha) return false;
    }

    if (!filtroTexto.trim()) return estaInternado;
    const term = filtroTexto.toLowerCase();
    return (
      p.usuario_nome?.toLowerCase().includes(term) ||
      p.nome_mae?.toLowerCase().includes(term) ||
      p.leito?.toLowerCase().includes(term) ||
      p.id_atendimento?.toLowerCase().includes(term) ||
      p.acompanhante_nome?.toLowerCase().includes(term) ||
      p.visitante_ativo?.toLowerCase().includes(term)
    );
  });

  // Estatísticas do Placar Geral
  const totalInternados = pacientes.filter((p) => p.status_internacao !== "ALTA").length;
  const totalVisitantesAtivos = pacientes.filter((p) => p.status_internacao !== "ALTA" && p.visitante_ativo).length;
  const totalAcompanhantes = pacientes.filter((p) => p.status_internacao !== "ALTA" && p.acompanhante_nome).length;
  const totalVermelha = pacientes.filter((p) => 
    p.status_internacao !== "ALTA" && 
    (p.setor_clinica?.toLowerCase().includes("vermelh") || p.leito?.toLowerCase().includes("vermelh"))
  ).length;

  if (aguardandoAprovacao) {
    return <AcessoPendente motivo="pendente" email={usuarioEmail} />;
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500 font-medium">
        Verificando credenciais e acessos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      {/* Modal de Check-In & Emissão de QR Code */}
      <CheckInAssistidoModal 
        isOpen={isModalCheckInOpen} 
        onClose={() => {
          setIsModalCheckInOpen(false);
          setModalTipoInicial(undefined);
          queryClient.invalidateQueries({ queryKey: ["pacientes"] });
        }} 
        pacienteId={pacienteFocado?.id}
        pacienteNome={pacienteFocado?.usuario_nome}
        leito={pacienteFocado?.leito}
        tipoInicial={modalTipoInicial}
      />

      {/* Modal de Confirmação de Alta Hospitalar */}
      <Dialog open={!!pacienteParaAlta} onOpenChange={(open) => !open && setPacienteParaAlta(null)}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-red-700 p-6 text-white">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <DoorOpen className="w-6 h-6 text-red-200" />
                Confirmação de Alta Hospitalar
              </DialogTitle>
              <DialogDescription className="text-red-100 text-sm">
                Registro oficial da Portaria para desocupação do leito e saída do paciente.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 bg-slate-50 space-y-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paciente & Leito</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {pacienteParaAlta?.usuario_nome}
              </div>
              <div className="text-xs text-primary-blue font-semibold mt-1">
                Leito: {pacienteParaAlta?.leito} | Atendimento: {pacienteParaAlta?.id_atendimento}
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl text-xs text-amber-900 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Ação Irreversível no Leito:</strong> O status mudará para <span className="font-bold">ALTA</span>, o leito será liberado imediatamente e todas as credenciais ativas deste paciente serão revogadas no banco.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Observações de Saída (Opcional)
              </label>
              <textarea
                rows={2}
                value={obsAlta}
                onChange={(e) => setObsAlta(e.target.value)}
                placeholder="Ex: Saída acompanhada pela família às 11:30"
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPacienteParaAlta(null)}
                disabled={isConfirmandoAlta}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAlta}
                disabled={isConfirmandoAlta}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <DoorOpen className="w-4 h-4" />
                {isConfirmandoAlta ? "Confirmando..." : "Confirmar Alta"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header Principal */}
      <header className="w-full bg-white shadow-sm p-5 flex flex-col md:flex-row justify-between items-center border-b-4 border-primary-blue gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-xs border border-slate-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo_hnsbc.png" 
              alt="Hospital Regional Nossa Senhora do Bom Conselho" 
              className="w-full h-full object-contain" 
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-primary-blue">Controle de Portaria & Visitas HNSBC</h1>
              <span className="bg-blue-100 text-primary-blue text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-blue-200">
                <Shield className="w-3.5 h-3.5" />
                {usuarioRole ? usuarioRole.toUpperCase() : "PORTARIA"}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">Hospital Regional Nossa Senhora do Bom Conselho — Arapiraca / AL</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/dashboard/portaria"
            className="flex items-center gap-1.5 text-xs font-bold text-primary-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2.5 rounded-xl transition-all"
          >
            <Shield className="w-4 h-4" /> Tablet Portaria
          </a>
          <a
            href="/dashboard/fono"
            className="flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3.5 py-2.5 rounded-xl transition-all"
          >
            <Baby className="w-4 h-4" /> Orelhinha Fono
          </a>
          <button 
            onClick={() => handleOpenCheckIn(pacientesFiltrados[0] || pacientes[0])}
            disabled={pacientes.length === 0}
            className="bg-primary-green hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 text-xs sm:text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Check-in Rápido
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="hidden xl:block text-xs text-gray-500 font-medium max-w-[160px] truncate" title={usuarioEmail}>
              {usuarioEmail}
            </span>
            <button
              onClick={sair}
              className="border border-slate-200 hover:border-red-300 hover:text-red-600 text-gray-600 px-3 py-2 rounded-xl font-semibold transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl p-6 flex flex-col gap-6">
        {/* Alerta de Notificação / Sucesso */}
        {mensagemSucesso && (
          <div className="p-4 bg-green-50 border-l-4 border-primary-green text-green-900 rounded-r-2xl font-semibold text-sm animate-in fade-in flex items-center justify-between shadow-xs">
            <span>{mensagemSucesso}</span>
            <button onClick={() => setMensagemSucesso("")} className="text-green-700 hover:text-green-900 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* 1. CARDS DE MÉTRICAS & PLACAR EM TEMPO REAL */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-primary-blue flex items-center justify-center shrink-0">
              <Bed className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Leitos Ocupados</span>
              <span className="text-2xl font-extrabold text-gray-900">{totalInternados}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">Pacientes Internados</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-primary-green flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Visitantes no Quarto</span>
              <span className="text-2xl font-extrabold text-primary-green">{totalVisitantesAtivos}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">Com acesso em andamento</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Acompanhantes</span>
              <span className="text-2xl font-extrabold text-purple-900">{totalAcompanhantes}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">Direito a 1 ativo (24h)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Área Vermelha</span>
              <span className="text-2xl font-extrabold text-red-700">{totalVermelha}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">Cota restrita (máx 1/dia)</span>
            </div>
          </div>
        </section>

        {/* 2. REGRAS DE HORÁRIO E FLUXOS EM TEMPO REAL */}
        <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-blue shrink-0" />
            <div>
              <h3 className="text-primary-blue font-bold text-sm">Janelas Oficiais de Acesso e Anti-Revezamento</h3>
              <p className="text-slate-600 text-xs">Normais: 15h–16h (máx 2/dia) | Vermelha: 16h–17h (máx 1/dia) | Trocas Acomp: 07h30–08h30 e 18h30–19h30</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {regras.map((regra) => (
              <span
                key={regra.id}
                className="bg-white border border-blue-200 text-blue-900 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5"
                title={regra.descricao}
              >
                <span className="w-2 h-2 rounded-full bg-primary-green"></span>
                <strong>{regra.tipo_regra}:</strong>
                {regra.horario_inicio && regra.horario_fim
                  ? `${regra.horario_inicio.substring(0, 5)}–${regra.horario_fim.substring(0, 5)}`
                  : 'Assistencial'}
              </span>
            ))}
          </div>
        </div>

        {/* 3. FORMULÁRIO DE BUSCA INTELIGENTE (AUTOCOMPLETE UNIFICADO) */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary-blue" />
              Busca Inteligente & Placar de Cotas
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Digite o Nome do Paciente, Nome da Mãe ou Leito para carregar o prontuário e consultar o placar de visitantes em tempo real.
            </p>
          </div>

          <AutoCompletePaciente
            pacientes={pacientes}
            onSelect={(paciente) => setPacienteFocado(paciente)}
          />

          {/* CARD DE DESTAQUE DO PACIENTE SELECIONADO NA BUSCA */}
          {pacienteFocado && (
            <div className="mt-5 p-5 bg-gradient-to-r from-blue-50/90 to-indigo-50/60 border-2 border-primary-blue/30 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-primary-blue bg-white px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                      Prontuário Ativo
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      ID Atendimento: <strong>{pacienteFocado.id_atendimento}</strong>
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{pacienteFocado.usuario_nome}</span>
                    <span className="text-primary-blue bg-blue-100/70 border border-blue-300 px-3 py-0.5 rounded-lg text-sm font-bold">
                      {pacienteFocado.leito}
                    </span>
                    {pacienteFocado.nome_mae && (
                      <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                        Mãe: {pacienteFocado.nome_mae}
                      </span>
                    )}
                  </h3>

                  {/* Placar de Cotas em Destaque */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    {(() => {
                      const isVermelha = pacienteFocado.setor_clinica?.toLowerCase().includes("vermelh") || pacienteFocado.leito?.toLowerCase().includes("vermelh");
                      const cotaMax = isVermelha ? 1 : 2;
                      const cotasUsadas = pacienteFocado.cotas_usadas ?? (pacienteFocado.visitante_ativo ? 1 : 0);
                      const cotaEsgotada = cotasUsadas >= cotaMax;

                      return (
                        <>
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-2xs ${
                            cotaEsgotada
                              ? "bg-red-50 text-red-800 border-red-300"
                              : "bg-emerald-50 text-emerald-800 border-emerald-300"
                          }`}>
                            <Users className="w-4 h-4" />
                            <span>Placar Hoje: <strong>{cotasUsadas}/{cotaMax}</strong></span>
                            {cotaEsgotada ? (
                              <span className="bg-red-200 text-red-900 px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold">Cota Esgotada</span>
                            ) : (
                              <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold">Vaga Disponível</span>
                            )}
                          </div>

                          <div className="text-xs text-gray-600 flex items-center gap-2">
                            <span>Acompanhante: <strong className="text-gray-900">{pacienteFocado.acompanhante_nome || "Nenhum"}</strong></span>
                            <span>•</span>
                            <span>Visitante no Quarto: <strong className="text-primary-green">{pacienteFocado.visitante_ativo || "Nenhum no momento"}</strong></span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Botões de Ação do Paciente Focado */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenCheckIn(pacienteFocado, 'visitante')}
                    className="bg-primary-green hover:bg-green-600 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Liberar Visitante
                  </button>

                  <button
                    onClick={() => handleOpenCheckIn(pacienteFocado, 'acompanhante')}
                    className="bg-primary-blue hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Trocar Acomp.
                  </button>

                  {pacienteFocado.visitante_ativo && (
                    <button
                      onClick={() => handleSaidaVisitante(pacienteFocado.id)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-amber-300"
                      title="Registrar Check-out do visitante"
                    >
                      <UserMinus className="w-4 h-4" />
                      Saída Visitante
                    </button>
                  )}

                  <button
                    onClick={() => setPacienteParaAlta(pacienteFocado)}
                    className="bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-red-200"
                    title="Confirmar Alta Hospitalar e desocupar o leito"
                  >
                    <DoorOpen className="w-4 h-4" />
                    Dar Alta
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. ABAS DE VISUALIZAÇÃO (DASHBOARD 360º VS SERVIÇO SOCIAL) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setAbaAtiva("geral")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 ${
                abaAtiva === "geral"
                  ? "bg-primary-blue text-white shadow-md"
                  : "text-gray-600 hover:bg-slate-200/60"
              }`}
            >
              <Bed className="w-4 h-4" />
              Painel de Leitos & Placar de Visitas
            </button>
            <button
              onClick={() => setAbaAtiva("servico_social")}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 ${
                abaAtiva === "servico_social"
                  ? "bg-primary-green text-white shadow-md"
                  : "text-gray-600 hover:bg-slate-200/60"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Serviço Social (Checklist Xerox)
            </button>
          </div>

          {abaAtiva === "geral" && (
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold rounded-xl px-3 py-2 text-gray-700 outline-none focus:border-primary-blue shadow-2xs"
              >
                <option value="TODOS">Todos os Setores</option>
                <option value="CLINICAS">Clínicas / Enfermarias (2 Visitas)</option>
                <option value="VERMELHA">Área Vermelha (1 Visita)</option>
              </select>

              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 text-xs font-bold text-primary-blue bg-white hover:bg-blue-50 px-3 py-2 rounded-xl border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                title="Atualizar dados em tempo real"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-primary-green" : ""}`} />
                <span>{isFetching ? "Atualizando..." : "Atualizar"}</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. TABELA GERAL OU SERVIÇO SOCIAL */}
        {abaAtiva === "servico_social" ? (
          <TabelaServicoSocial pacientes={pacientesFiltrados} loading={loading} />
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-primary-blue to-blue-800 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bed className="w-5 h-5 text-blue-200" />
                  Painel de Leitos & Placar de Visitas em Tempo Real
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  Monitoramento diário de cotas de visitantes (anti-revezamento) e acompanhantes por leito
                </p>
              </div>
              <div className="bg-white/20 px-3.5 py-1.5 rounded-xl backdrop-blur-sm text-xs font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {pacientesFiltrados.length} Leitos Monitorados
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-gray-500 font-medium">
                  Carregando lista de leitos e pacientes do sistema...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-gray-700 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="p-4 font-bold">Leito & Setor</th>
                      <th className="p-4 font-bold">Paciente & Mãe</th>
                      <th className="p-4 font-bold text-center">Placar de Visitas (Hoje)</th>
                      <th className="p-4 font-bold">Acompanhante Atual</th>
                      <th className="p-4 font-bold">Visitante no Quarto</th>
                      <th className="p-4 font-bold text-center">Ações Portaria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pacientesFiltrados.map((p) => {
                      const isVermelha = p.setor_clinica?.toLowerCase().includes("vermelh") || p.leito?.toLowerCase().includes("vermelh");
                      const cotaMax = isVermelha ? 1 : 2;
                      const cotasUsadas = p.cotas_usadas ?? (p.visitante_ativo ? 1 : 0);
                      const cotaEsgotada = cotasUsadas >= cotaMax;

                      return (
                        <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                          {/* Leito & Setor */}
                          <td className="p-4">
                            <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold shadow-2xs ${
                              isVermelha 
                                ? "bg-red-100 text-red-800 border border-red-200" 
                                : "bg-blue-100 text-primary-blue border border-blue-200"
                            }`}>
                              {p.leito}
                            </span>
                            <span className="block text-[11px] text-gray-500 font-medium mt-1">
                              {p.setor_clinica || (isVermelha ? "Área Vermelha" : "Clínica Geral")}
                            </span>
                          </td>

                          {/* Paciente & Mãe */}
                          <td className="p-4">
                            <span className="font-bold text-gray-900 block text-base">{p.usuario_nome}</span>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                              <span>ID: <strong>{p.id_atendimento}</strong></span>
                              {p.nome_mae && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600">Mãe: <strong>{p.nome_mae}</strong></span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Placar de Visitas em Tempo Real */}
                          <td className="p-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border shadow-2xs ${
                                cotaEsgotada
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}>
                                <Users className="w-3.5 h-3.5" />
                                {cotasUsadas}/{cotaMax}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium mt-1">
                                {cotaEsgotada ? "Cota esgotada" : `${cotaMax - cotasUsadas} vaga(s) restante(s)`}
                              </span>
                            </div>
                          </td>

                          {/* Acompanhante Atual */}
                          <td className="p-4 text-gray-700">
                            {p.acompanhante_nome ? (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-primary-blue flex items-center justify-center text-xs font-bold shrink-0">
                                  {p.acompanhante_nome.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-800">{p.acompanhante_nome}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Nenhum cadastrado</span>
                            )}
                          </td>

                          {/* Visitante no Quarto */}
                          <td className="p-4">
                            {p.visitante_ativo ? (
                              <div className="flex items-center justify-between gap-2 bg-green-50 p-2 rounded-xl border border-green-200">
                                <span className="text-primary-green text-xs font-bold flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-primary-green animate-pulse"></span>
                                  {p.visitante_ativo}
                                </span>
                                <button
                                  onClick={() => handleSaidaVisitante(p.id)}
                                  title="Registrar Saída do Visitante (Check-out)"
                                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Quarto livre</span>
                            )}
                          </td>

                          {/* Ações da Portaria */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenCheckIn(p, 'visitante')}
                                className="bg-primary-green hover:bg-green-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                                title="Liberar novo visitante ou trocar acompanhante"
                              >
                                Check-in
                              </button>
                              <button
                                onClick={() => setPacienteParaAlta(p)}
                                className="text-red-700 hover:bg-red-50 border border-red-200 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Registrar Alta Hospitalar"
                              >
                                Alta
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {pacientesFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          {filtroTexto 
                            ? `Nenhum leito ou paciente localizado para a busca "${filtroTexto}".`
                            : "Nenhum paciente internado encontrado neste setor."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary fallbackTitle="Erro ao carregar o Painel da Portaria">
      <DashboardContent />
    </ErrorBoundary>
  );
}
