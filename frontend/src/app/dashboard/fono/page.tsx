"use client";

import React, { useState } from "react";
import Link from "next/link";
import ErrorBoundary from "../../../components/ErrorBoundary";
import {
  Baby,
  Calendar,
  Clock,
  Edit2,
  Check,
  X,
  ShieldAlert,
  Plus,
  Trash2,
  CalendarCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";

interface ConsultaOrelhinha {
  id: number;
  paciente: string;
  leito: string;
  responsavel: string;
  data: string;
  horario: string;
  status: "Agendado" | "Realizado" | "Reagendado" | "Cancelado";
  observacoes?: string;
}

const CONSULTAS_INICIAIS: ConsultaOrelhinha[] = [
  { id: 1, paciente: "RN de Maria Eduarda", leito: "Maternidade 03", responsavel: "Maria Eduarda (Mãe)", data: "2026-10-12", horario: "09:00", status: "Agendado" },
  { id: 2, paciente: "RN de Camila Santos", leito: "Berçário 02", responsavel: "Lucas Santos (Pai)", data: "2026-10-12", horario: "10:30", status: "Agendado" },
  { id: 3, paciente: "RN de Beatriz Lima", leito: "Maternidade 07", responsavel: "Beatriz Lima (Mãe)", data: "2026-10-12", horario: "14:00", status: "Agendado" },
  { id: 4, paciente: "RN de Juliana Costa", leito: "Berçário 04", responsavel: "Juliana Costa (Mãe)", data: "2026-10-13", horario: "08:30", status: "Agendado" },
];

function FonoDashboardContent() {
  const [consultas, setConsultas] = useState<ConsultaOrelhinha[]>(CONSULTAS_INICIAIS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  // Estado do Modal de Adicionar Novo Agendamento
  const [isModalNovoOpen, setIsModalNovoOpen] = useState(false);
  const [novoPaciente, setNovoPaciente] = useState("");
  const [novoLeito, setNovoLeito] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [novaData, setNovaData] = useState(() => new Date().toISOString().split("T")[0]);
  const [novoHorario, setNovoHorario] = useState("09:00");
  const [novaObservacao, setNovaObservacao] = useState("");

  const handleStartEdit = (c: ConsultaOrelhinha) => {
    setEditingId(c.id);
    setEditData(c.data);
    setEditHorario(c.horario);
  };

  const handleSaveEdit = (id: number) => {
    setConsultas((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, data: editData, horario: editHorario, status: "Reagendado" }
          : c
      )
    );
    setEditingId(null);
    setMensagemSucesso(`Data e horário da consulta #${id} atualizados com sucesso!`);
    setTimeout(() => setMensagemSucesso(""), 4000);
  };

  const handleAdicionarConsulta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPaciente.trim() || !novaData || !novoHorario) return;

    const novoId = Math.max(...consultas.map((c) => c.id), 0) + 1;
    const novaConsulta: ConsultaOrelhinha = {
      id: novoId,
      paciente: novoPaciente.trim(),
      leito: novoLeito.trim() || "Maternidade",
      responsavel: novoResponsavel.trim() || "Mãe/Pai",
      data: novaData,
      horario: novoHorario,
      status: "Agendado",
      observacoes: novaObservacao.trim(),
    };

    setConsultas((prev) => [novaConsulta, ...prev]);
    setIsModalNovoOpen(false);

    // Reset formulário
    setNovoPaciente("");
    setNovoLeito("");
    setNovoResponsavel("");
    setNovaObservacao("");
    setMensagemSucesso(`Novo agendamento criado para ${novaConsulta.paciente} em ${novaConsulta.data} às ${novaConsulta.horario}!`);
    setTimeout(() => setMensagemSucesso(""), 5000);
  };

  const handleExcluirConsulta = (id: number) => {
    if (confirm("Deseja realmente remover este agendamento?")) {
      setConsultas((prev) => prev.filter((c) => c.id !== id));
      setMensagemSucesso(`Agendamento #${id} removido.`);
      setTimeout(() => setMensagemSucesso(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      {/* Modal shadcn/ui: Adicionar Data & Horário do Teste da Orelhinha */}
      <Dialog open={isModalNovoOpen} onOpenChange={setIsModalNovoOpen}>
        <DialogContent className="max-w-xl bg-white rounded-3xl p-0 overflow-hidden border-0">
          <div className="bg-gradient-to-r from-purple-700 to-indigo-800 p-6 text-white">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-6 h-6 text-purple-300" />
                Agendar Teste da Orelhinha
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-sm">
                Insira a data, horário e os dados do recém-nascido para registro na triagem auditiva neonatal.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleAdicionarConsulta} className="p-6 bg-slate-50 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Recém-Nascido / Paciente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: RN de Mariana Silva"
                value={novoPaciente}
                onChange={(e) => setNovoPaciente(e.target.value)}
                className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100 font-medium text-sm transition-all shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Leito / Setor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Maternidade 05"
                  value={novoLeito}
                  onChange={(e) => setNovoLeito(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100 font-medium text-sm transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Responsável
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mariana Silva (Mãe)"
                  value={novoResponsavel}
                  onChange={(e) => setNovoResponsavel(e.target.value)}
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100 font-medium text-sm transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Campos Principais: Data e Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl">
              <div>
                <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-700" />
                  Data da Consulta *
                </label>
                <input
                  type="date"
                  required
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-purple-300 rounded-xl text-gray-900 font-bold text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-200 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-700" />
                  Horário do Exame *
                </label>
                <input
                  type="time"
                  required
                  value={novoHorario}
                  onChange={(e) => setNovoHorario(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-purple-300 rounded-xl text-gray-900 font-bold text-sm outline-none focus:border-purple-700 focus:ring-2 focus:ring-purple-200 transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Observações Clínicas (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Primeira triagem, sem intercorrências"
                value={novaObservacao}
                onChange={(e) => setNovaObservacao(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 text-sm shadow-2xs"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalNovoOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-2 py-3 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Confirmar Agendamento
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header da Página */}
      <header className="w-full bg-white border-b-4 border-purple-600 shadow-sm p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm border border-slate-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_hnsbc.png" alt="Hospital Regional Nossa Senhora do Bom Conselho" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-purple-900">Fonoaudiologia - Teste da Orelhinha</h1>
              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Baby className="w-3.5 h-3.5" /> Setor Fonoaudiologia
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium">Gestão e Agendamento Exclusivo de Triagem Auditiva Neonatal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalNovoOpen(true)}
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar Data & Horário
          </button>
          <Link
            href="/"
            className="text-sm font-bold text-gray-600 hover:text-purple-700 transition-colors px-4 py-2 border rounded-xl"
          >
            Voltar ao Painel Geral
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl p-6 flex flex-col gap-6">
        {/* Aviso de Isolamento Setorial */}
        <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-purple-700 shrink-0" />
            <p className="text-sm text-purple-950 font-medium">
              <strong>Controle Estrito de Edição:</strong> Somente profissionais da <strong>Fonoaudiologia</strong> possuem autorização para incluir e alterar datas e horários de exames do Teste da Orelhinha.
            </p>
          </div>
          <button
            onClick={() => setIsModalNovoOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 bg-white text-purple-800 font-bold text-xs px-3.5 py-2 rounded-xl border border-purple-300 shadow-2xs hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Agendamento
          </button>
        </div>

        {mensagemSucesso && (
          <div className="p-4 bg-green-50 border-l-4 border-primary-green text-green-800 rounded-r-xl font-medium text-sm animate-in fade-in flex items-center justify-between">
            <span>{mensagemSucesso}</span>
            <button onClick={() => setMensagemSucesso("")} className="text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabela Interativa de Agendamento Dinâmico */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Calendar className="w-6 h-6" /> Agenda Dinâmica do Teste da Orelhinha
              </h2>
              <p className="text-purple-200 text-xs mt-1">
                Adicione novos horários ou altere as consultas existentes diretamente nas linhas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalNovoOpen(true)}
                className="bg-white text-purple-900 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md hover:bg-purple-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-purple-700" />
                Adicionar Data/Horário
              </button>
              <span className="bg-white/20 px-3.5 py-2 rounded-xl text-xs font-bold backdrop-blur-sm">
                {consultas.length} Agendamentos Ativos
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-700 text-sm border-b">
                  <th className="p-5 font-semibold">Recém-Nascido</th>
                  <th className="p-5 font-semibold">Leito</th>
                  <th className="p-5 font-semibold">Pai/Mãe ou Responsável</th>
                  <th className="p-5 font-semibold">Data da Consulta</th>
                  <th className="p-5 font-semibold">Horário</th>
                  <th className="p-5 font-semibold">Status</th>
                  <th className="p-5 font-semibold text-center">Ações (Exclusivo Fono)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {consultas.map((c) => {
                  const isEditing = editingId === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-5">
                        <span className="font-bold text-gray-900 block">{c.paciente}</span>
                        {c.observacoes && (
                          <span className="text-[11px] text-gray-500 italic block mt-0.5">{c.observacoes}</span>
                        )}
                      </td>
                      <td className="p-5">
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                          {c.leito}
                        </span>
                      </td>
                      <td className="p-5 text-gray-600">{c.responsavel}</td>
                      <td className="p-5">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData}
                            onChange={(e) => setEditData(e.target.value)}
                            className="p-2 border-2 border-purple-400 rounded-lg text-xs font-bold outline-none bg-white shadow-2xs"
                          />
                        ) : (
                          <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            {c.data}
                          </span>
                        )}
                      </td>
                      <td className="p-5">
                        {isEditing ? (
                          <input
                            type="time"
                            value={editHorario}
                            onChange={(e) => setEditHorario(e.target.value)}
                            className="p-2 border-2 border-purple-400 rounded-lg text-xs font-bold outline-none bg-white shadow-2xs"
                          />
                        ) : (
                          <span className="font-bold text-purple-900 flex items-center gap-1">
                            <Clock className="w-4 h-4 text-purple-600" />
                            {c.horario}
                          </span>
                        )}
                      </td>
                      <td className="p-5">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            c.status === "Reagendado"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(c.id)}
                              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors cursor-pointer shadow-xs"
                              title="Salvar novo horário"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleStartEdit(c)}
                              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Alterar Data/Horário
                            </button>
                            <button
                              onClick={() => handleExcluirConsulta(c.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Excluir agendamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
