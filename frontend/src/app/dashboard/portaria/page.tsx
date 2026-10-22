"use client";

import React, { useState } from "react";
import Link from "next/link";
import ErrorBoundary from "../../../components/ErrorBoundary";
import AutoCompletePaciente from "../../../components/AutoCompletePaciente";
import CheckInAssistidoModal from "../../../components/CheckInAssistidoModal";
import { fetchPacientes, Paciente } from "../../../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Calendar, Eye, UserCheck, Bed, Clock } from "lucide-react";

// Mock da agenda da Fonoaudiologia para visualização Read-Only da Portaria
const AGENDA_FONO_READONLY = [
  { id: 1, paciente: "RN de Maria Eduarda", leito: "Maternidade 03", horario: "09:00", status: "Confirmado" },
  { id: 2, paciente: "RN de Camila Santos", leito: "Berçário 02", horario: "10:30", status: "Em Espera" },
  { id: 3, paciente: "RN de Beatriz Lima", leito: "Maternidade 07", horario: "14:00", status: "Agendado" },
];

function PortariaDashboardContent() {
  const [pacienteFocado, setPacienteFocado] = useState<Paciente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: pacientes = [], isLoading, isError } = useQuery({
    queryKey: ["pacientes"],
    queryFn: fetchPacientes,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <CheckInAssistidoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["pacientes"] });
        }}
        pacienteId={pacienteFocado?.id}
        pacienteNome={pacienteFocado?.usuario_nome}
        leito={pacienteFocado?.leito}
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
        <Link
          href="/"
          className="text-sm font-bold text-gray-600 hover:text-primary-blue transition-colors px-4 py-2 border rounded-xl"
        >
          Voltar ao Painel Geral
        </Link>
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
            onSelect={(paciente) => {
              setPacienteFocado(paciente);
            }}
          />

          {pacienteFocado && (
            <div className="mt-6 p-5 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-primary-blue uppercase tracking-wider">Paciente Selecionado</span>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">
                  {pacienteFocado.usuario_nome} — <span className="text-primary-blue">{pacienteFocado.leito}</span>
                </h3>
                <div className="text-sm text-gray-600 mt-1 flex gap-4">
                  <span>Atendimento: <strong>{pacienteFocado.id_atendimento}</strong></span>
                  <span>Acompanhante: <strong>{pacienteFocado.acompanhante_nome || "Nenhum"}</strong></span>
                  <span>Visitante: <strong>{pacienteFocado.visitante_ativo || "Livre"}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary-green hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
              >
                <UserCheck className="w-5 h-5" />
                Liberar Acesso / Check-in
              </button>
            </div>
          )}
        </section>

        {/* Bloco 2: Agenda da Fonoaudiologia (READ-ONLY) */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-300" />
                <h2 className="text-xl font-bold">Agenda do Teste da Orelhinha (Fonoaudiologia)</h2>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">Visualização da Portaria para orientação de pais e responsáveis</p>
            </div>
            <span className="bg-purple-950/60 border border-purple-400/40 text-purple-200 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Somente Leitura (Read-Only)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-700 text-sm border-b">
                  <th className="p-4 font-semibold">Horário Previsto</th>
                  <th className="p-4 font-semibold">Recém-Nascido / Paciente</th>
                  <th className="p-4 font-semibold">Leito de Origem</th>
                  <th className="p-4 font-semibold">Status do Agendamento</th>
                  <th className="p-4 font-semibold text-center">Permissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {AGENDA_FONO_READONLY.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="p-4 font-bold text-gray-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-purple-600" />
                      {item.horario}
                    </td>
                    <td className="p-4 font-semibold text-gray-800">{item.paciente}</td>
                    <td className="p-4 text-gray-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700">
                        {item.leito}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
                        Alteração bloqueada (Setor Fono)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
