"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ErrorBoundary from "../../../components/ErrorBoundary";
import AutoCompletePaciente from "../../../components/AutoCompletePaciente";
import CheckInAssistidoModal from "../../../components/CheckInAssistidoModal";
import PacienteSelecionadoCard from "../../../components/PacienteSelecionadoCard";
import { fetchPacientes, fetchPacienteCompleto, registrarSaidaVisitante, Paciente, Visitante } from "../../../services/api";
import { useVisitasStore } from "../../../context/VisitasContext";
import { useOrelhinhaStore } from "../../../context/OrelhinhaContext";
import OrelhinhaTable from "../../../components/OrelhinhaTable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Calendar, Eye, Bed, Clock, Baby } from "lucide-react";

function PortariaDashboardContent() {
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTipoInicial, setModalTipoInicial] = useState<'visitante' | 'acompanhante' | undefined>(undefined);

  const { adicionarVisitante: adicionarVisitanteNaStore } = useVisitasStore();
  const { adicionarConsultaOrelhinha } = useOrelhinhaStore();

  const queryClient = useQueryClient();

  const { data: pacientes = [], isLoading, isError } = useQuery({
    queryKey: ["pacientes"],
    queryFn: fetchPacientes,
  });

  // 1. Efeito no ciclo de vida (Mount): busca os dados completos do paciente via API (GET) assim que o componente montar
  // Garante que o estado pacienteSelecionado seja populado com acompanhante e visitantes, sobrevivendo a recarregamentos (F5)
  useEffect(() => {
    let montado = true;

    const carregarPacienteNoCicloDeVida = async () => {
      try {
        let idAlvo: number | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const idUrl = params.get("pacienteId") || params.get("id");
          const idSalvo = localStorage.getItem("portaria_paciente_selecionado_id");
          if (idUrl) idAlvo = Number(idUrl);
          else if (idSalvo) idAlvo = Number(idSalvo);
        }

        // Padrão inicial caso não haja ID explícito salvo: id 3 (Mariana Santos Lima)
        if (!idAlvo) {
          idAlvo = 3;
        }

        // Requisição GET via API completa de paciente
        const dadosCompletos = await fetchPacienteCompleto(idAlvo);
        if (montado && dadosCompletos) {
          setPacienteSelecionado(dadosCompletos);
          if (typeof window !== "undefined") {
            localStorage.setItem("portaria_paciente_selecionado_id", String(dadosCompletos.id));
          }
        }
      } catch (err) {
        console.error("Erro ao buscar dados completos do paciente na montagem:", err);
      }
    };

    carregarPacienteNoCicloDeVida();

    return () => {
      montado = false;
    };
  }, []);

  // 2. Sincronização reativa: atualiza pacienteSelecionado quando a query de pacientes for refetchada ou alterada
  useEffect(() => {
    if (pacienteSelecionado) {
      const atualizado = pacientes.find((p: Paciente) => p.id === pacienteSelecionado.id);
      if (atualizado) {
        setPacienteSelecionado((prev) => {
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

  // 3. Callback de sucesso da mutation/liberação de acesso: atualiza o estado imediatamente
  const handleAcessoSucesso = (dados: {
    tipo: 'visitante' | 'acompanhante' | 'orelhinha' | 'obito';
    nome: string;
    documento?: string;
    telefone?: string;
  }) => {
    setPacienteSelecionado((prev) => {
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
        // Procedimento de Teste da Orelhinha: cota independente, gerenciado na store de Orelhinha
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

        // Retorna paciente sem alterar cotas_usadas ou contador de visitantes
        return {
          ...prev,
          procedimentos_ativos: [...listaProcedimentos, novoProc],
        };
      }
      return prev;
    });

    queryClient.invalidateQueries({ queryKey: ["pacientes"] });
  };

  const handleSaidaVisitante = async (pacienteId: number, visitanteId?: number) => {
    if (confirm("Confirmar o registro de saída deste acesso?")) {
      try {
        await registrarSaidaVisitante(pacienteId, visitanteId);
        setPacienteSelecionado((prev) => {
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
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao registrar saída.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <CheckInAssistidoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalTipoInicial(undefined);
          queryClient.invalidateQueries({ queryKey: ["pacientes"] });
        }}
        pacienteId={pacienteSelecionado?.id}
        pacienteNome={pacienteSelecionado?.usuario_nome}
        leito={pacienteSelecionado?.leito}
        tipoInicial={modalTipoInicial}
        onSuccess={handleAcessoSucesso}
      />

      <header className="w-full bg-white border-b-4 border-primary-blue shadow-sm p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm border border-slate-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_hnsbc.png" alt="Hospital Regional Nossa Senhora do Bom Conselho" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary-blue">Controle de Acesso - Portaria</h1>
              <span className="bg-blue-100 text-primary-blue text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> RBAC Portaria
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium">Hospital Regional Nossa Senhora do Bom Conselho</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/fono"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
            title="Ir para o fluxo exclusivo de Fonoaudiologia e Teste da Orelhinha"
          >
            <Baby className="w-4 h-4 text-purple-600" />
            <span>Orelhinha Fono</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-bold text-gray-600 hover:text-primary-blue transition-colors px-4 py-2 border rounded-xl"
          >
            Voltar ao Painel Geral
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl p-6 flex flex-col gap-8">
        {/* Bloco 1: Busca Inteligente (AutoComplete) */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Bed className="w-5 h-5 text-primary-blue" />
            Busca Inteligente de Leitos e Pacientes (Tablet-Optimized)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Digite o nome do paciente, quarto ou número do atendimento para consultar e liberar acessos instantaneamente.
          </p>

          {isLoading && (
            <p className="text-sm text-primary-blue font-medium mb-3" role="status">Carregando pacientes...</p>
          )}
          {isError && (
            <p className="text-sm text-red-700 bg-red-50 border-l-4 border-red-500 p-3 mb-3 font-medium" role="alert">
              Não foi possível carregar a lista de pacientes. Verifique a conexão e recarregue a página.
            </p>
          )}

          <AutoCompletePaciente
            pacientes={pacientes}
            onSelect={async (paciente) => {
              if (typeof window !== "undefined") {
                localStorage.setItem("portaria_paciente_selecionado_id", String(paciente.id));
              }
              // Busca os dados completos da API (GET) incluindo histórico de acompanhantes e visitantes
              const dadosCompletos = await fetchPacienteCompleto(paciente.id);
              setPacienteSelecionado(dadosCompletos || paciente);
            }}
          />

          {pacienteSelecionado && (
            <PacienteSelecionadoCard
              paciente={pacienteSelecionado}
              onLiberarAcesso={() => {
                setModalTipoInicial(undefined);
                setIsModalOpen(true);
              }}
              onSaidaVisitante={handleSaidaVisitante}
            />
          )}
        </section>

        {/* Bloco 2: Triagem Auditiva Neonatal (Teste da Orelhinha) — Integração Portaria */}
        <OrelhinhaTable
          perfilProp="portaria"
          titulo="Agenda da Triagem Auditiva Neonatal (Portaria)"
          subtitulo="Controle de Chegada e Check-in de Pacientes • Data e Hora do Exame restritas à Fonoaudiologia"
        />
      </main>
    </div>
  );
}

export default function PortariaDashboardPage() {
  return (
    <ErrorBoundary fallbackTitle="Erro no Painel da Portaria">
      <PortariaDashboardContent />
    </ErrorBoundary>
  );
}
