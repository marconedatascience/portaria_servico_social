"use client";

import React, { useState, useEffect } from "react";
import CheckInAssistidoModal from "../components/CheckInAssistidoModal";
import TabelaServicoSocial from "../components/TabelaServicoSocial";
import AutoCompletePaciente from "../components/AutoCompletePaciente";
import PacienteSelecionadoCard from "../components/PacienteSelecionadoCard";
import { 
  fetchPacientes, 
  fetchRegras, 
  desocuparVisitante, 
  fetchPacientePorId,
  Paciente,
  Visitante
} from "../services/api";
import { useVisitasStore } from "../context/VisitasContext";
import { useOrelhinhaStore } from "../context/OrelhinhaContext";
import CardVisitanteNoQuarto from "../components/CardVisitanteNoQuarto";
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
  AlertTriangle
} from "lucide-react";

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
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const { adicionarVisitante: adicionarVisitanteNaStore } = useVisitasStore();
  const { adicionarConsultaOrelhinha } = useOrelhinhaStore();

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

  // Hidratação (F5): no componente principal, faz um GET /pacientes/:id ao montar a tela, garantindo que os dados não se percam no recarregamento.
  useEffect(() => {
    let montado = true;

    const hidratarPacienteAposF5 = async () => {
      try {
        let idAlvo: number | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const idUrl = params.get("pacienteId") || params.get("id");
          const idSalvo = localStorage.getItem("portaria_paciente_selecionado_id") || localStorage.getItem("paciente_selecionado_id");
          if (idUrl) idAlvo = Number(idUrl);
          else if (idSalvo) idAlvo = Number(idSalvo);
        }

        // Padrão inicial caso não haja ID explícito salvo
        if (!idAlvo) {
          idAlvo = 1;
        }

        // Requisição GET /pacientes/:id para hidratação
        const dadosCompletos = await fetchPacientePorId(idAlvo);
        if (montado && dadosCompletos) {
          setPacienteFocado(dadosCompletos);
          if (typeof window !== "undefined") {
            localStorage.setItem("portaria_paciente_selecionado_id", String(dadosCompletos.id));
          }
        }
      } catch (err) {
        console.error("Erro ao hidratar paciente via GET /pacientes/:id após F5:", err);
      }
    };

    hidratarPacienteAposF5();

    return () => {
      montado = false;
    };
  }, []);

  // 1. Sincronização via useEffect: atualiza pacienteFocado quando a lista de pacientes for refetchada ou alterada
  useEffect(() => {
    if (pacienteFocado) {
      const atualizado = pacientes.find(p => p.id === pacienteFocado.id);
      if (atualizado) {
        setPacienteFocado((prev) => {
          if (!prev) return atualizado;
          return {
            ...prev,
            ...atualizado,
            visitantes: (atualizado.visitantes && atualizado.visitantes.length > 0)
              ? atualizado.visitantes
              : prev.visitantes,
            acompanhante: atualizado.acompanhante || prev.acompanhante,
          };
        });
      }
    }
  }, [pacientes]);

  // 2. Callback de sucesso da mutation/troca de acompanhante ou visitante
  const handleAcessoSucesso = (dados: {
    tipo: 'visitante' | 'acompanhante' | 'orelhinha' | 'obito';
    nome: string;
    documento?: string;
    telefone?: string;
  }) => {
    setPacienteFocado((prev) => {
      if (!prev) return null;
      if (dados.tipo === 'acompanhante') {
        return {
          ...prev,
          acompanhante_nome: dados.nome,
          acompanhante_documento: dados.documento || null,
          acompanhante_telefone: dados.telefone || null,
          acompanhante: {
            nome: dados.nome,
            documento: dados.documento || null,
            telefone: dados.telefone || null,
          },
        };
      } else if (dados.tipo === 'visitante') {
        const novoVis: Visitante = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          nome: dados.nome,
          documento: dados.documento || null,
          telefone: dados.telefone || null,
          data_entrada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'ATIVO',
          isProcedimento: false,
          tipoAcesso: 'VISITANTE',
        };
        const listaAnterior: Visitante[] = Array.isArray(prev.visitantes)
          ? prev.visitantes
          : (prev.visitante ? [prev.visitante] : (prev.visitante_ativo ? [{ id: prev.id * 1000 + 1, nome: prev.visitante_ativo, documento: prev.visitante_documento, telefone: prev.visitante_telefone }] : []));
        const novosVisitantes = [...listaAnterior, novoVis];
        const visitantesSociais = novosVisitantes.filter(v => !v.isProcedimento && v.tipoAcesso !== 'ORELHINHA');
        const novasCotas = (prev.cotas_usadas ?? 0) + 1;

        // Atualiza a store de Visitas
        adicionarVisitanteNaStore(prev.id, novoVis);

        return {
          ...prev,
          visitante_ativo: visitantesSociais.map(v => v.nome).join(', '),
          visitante_documento: dados.documento || null,
          visitante_telefone: dados.telefone || null,
          visitante: novoVis,
          visitantes: novosVisitantes,
          cotas_usadas: novasCotas,
          placar: `Visitantes: ${novasCotas}/${prev.cota_maxima ?? 2}`,
        };
      } else if (dados.tipo === 'orelhinha') {
        // Procedimento clínico não consome cota diária de visitas sociais e é gerenciado pela store da Orelhinha
        const novoProc: Visitante = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          nome: dados.nome,
          documento: dados.documento || null,
          telefone: dados.telefone || null,
          data_entrada: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'ATIVO',
          isProcedimento: true,
          tipoAcesso: 'ORELHINHA',
        };

        // Dispara ação isolada na store da Orelhinha (NÃO incrementa contador de visitantes)
        adicionarConsultaOrelhinha({
          paciente: prev.usuario_nome,
          leito: prev.leito,
          responsavel: dados.nome,
          data: new Date().toISOString().split("T")[0],
          horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: "Agendado",
          presenca: "Presente",
        });

        const listaProcedimentos: Visitante[] = Array.isArray(prev.procedimentos_ativos) ? prev.procedimentos_ativos : [];

        // Retorna paciente sem alterar cotas_usadas ou placar de visitas
        return {
          ...prev,
          procedimentos_ativos: [...listaProcedimentos, novoProc],
        };
      }
      return prev;
    });

    queryClient.invalidateQueries({ queryKey: ["pacientes"] });
  };

  // Proteção de rota por perfil JWT
  useEffect(() => {
    let montado = true;

    const verificarAcesso = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          if (montado) window.location.replace("/login");
          return;
        }

        if (!montado) return;
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
      } catch (err) {
        console.error("Erro na verificação de sessão:", err);
        if (montado) window.location.replace("/login");
      }
    };

    verificarAcesso();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        window.location.replace("/login");
      }
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
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

  const handleSaidaVisitante = async (pacienteId: number, visitanteId?: number) => {
    if (confirm("Deseja registrar a saída do visitante deste leito?")) {
      try {
        await desocuparVisitante(pacienteId, visitanteId);
        setMensagemSucesso("Saída do visitante registrada com sucesso.");
        setPacienteFocado((prev) => {
          if (!prev || prev.id !== pacienteId) return prev;
          const listaAtual: Visitante[] = Array.isArray(prev.visitantes)
            ? prev.visitantes
            : (prev.visitante ? [prev.visitante] : []);
          const filtrados = visitanteId !== undefined
            ? listaAtual.filter((v) => v.id !== visitanteId)
            : [];
          const novosProcedimentos = (prev.procedimentos_ativos || []).filter(v => v.id !== visitanteId);
          const visitantesSociais = filtrados.filter(v => !v.isProcedimento && v.tipoAcesso !== 'ORELHINHA');
          const ultimo = visitantesSociais.length > 0 ? visitantesSociais[visitantesSociais.length - 1] : null;

          return {
            ...prev,
            visitantes: filtrados,
            procedimentos_ativos: novosProcedimentos,
            visitante: ultimo,
            visitante_ativo: visitantesSociais.length > 0 ? visitantesSociais.map(v => v.nome).join(', ') : null,
            visitante_documento: ultimo?.documento || null,
            visitante_telefone: ultimo?.telefone || null,
          };
        });
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-gray-600 gap-4 p-6">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-lg text-slate-700">Verificando credenciais e acessos...</p>
        <p className="text-sm text-gray-500">Redirecionando para o portal de acesso seguro...</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            href="/login"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-all text-sm"
          >
            Acessar Tela de Login
          </a>
          <a
            href="/dashboard/portaria"
            className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl shadow-sm transition-all text-sm"
          >
            Painel da Portaria
          </a>
        </div>
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
        onSuccess={handleAcessoSucesso}
      />

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
            <PacienteSelecionadoCard
              paciente={pacienteFocado}
              onOpenCheckIn={(tipo) => handleOpenCheckIn(pacienteFocado, tipo)}
              onSaidaVisitante={handleSaidaVisitante}
            />
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
                            <CardVisitanteNoQuarto
                              compacto
                              visitantes={p.visitantes || (p.visitante_ativo ? [{
                                id: p.id * 1000 + 1,
                                nome: p.visitante_ativo,
                                documento: p.visitante_documento,
                                telefone: p.visitante_telefone,
                              }] : [])}
                              pacienteId={p.id}
                              onSaidaVisitante={(visId) => handleSaidaVisitante(p.id, visId)}
                            />
                          </td>

                          {/* Ações da Portaria */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => handleOpenCheckIn(p, 'visitante')}
                                className="bg-primary-green hover:bg-green-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                                title="Liberar novo visitante ou trocar acompanhante"
                              >
                                Check-in
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
