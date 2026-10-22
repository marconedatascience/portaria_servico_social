"use client";

import React, { useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import { Paciente } from "../services/api";
import { FileCheck, FileX, Phone, MapPin, Calendar, CheckSquare, Sparkles } from "lucide-react";

interface DocumentosChecklistState {
  [pacienteId: number]: {
    tem_rg: boolean;
    tem_cpf: boolean;
    tem_sus: boolean;
    tem_comprovante_residencia: boolean;
  };
}

interface TabelaServicoSocialProps {
  pacientes: Paciente[];
  loading?: boolean;
}

export default function TabelaServicoSocial({ pacientes, loading }: TabelaServicoSocialProps) {
  // Estado local para controle interativo dos checkboxes de xerox por paciente
  const [checklist, setChecklist] = useState<DocumentosChecklistState>(() => {
    const estadoInicial: DocumentosChecklistState = {};
    pacientes.forEach((p, idx) => {
      estadoInicial[p.id] = {
        tem_rg: idx % 2 === 0,
        tem_cpf: true,
        tem_sus: true,
        tem_comprovante_residencia: idx % 3 === 0,
      };
    });
    return estadoInicial;
  });

  const toggleDocumento = (pacienteId: number, campo: "tem_rg" | "tem_cpf" | "tem_sus" | "tem_comprovante_residencia") => {
    setChecklist((prev) => ({
      ...prev,
      [pacienteId]: {
        ...prev[pacienteId],
        [campo]: !prev[pacienteId]?.[campo],
      },
    }));
  };

  return (
    <ErrorBoundary fallbackTitle="Erro na Tabela do Serviço Social">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-6 bg-gradient-to-r from-primary-green to-emerald-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CheckSquare className="w-6 h-6" /> Visão 360º — Serviço Social & Triagem de Documentos
            </h2>
            <p className="text-emerald-100 text-xs mt-1">
              Controle interativo de xerox obrigatórias para alta hospitalar e laudos sociais
            </p>
          </div>
          <div className="bg-white/20 px-4 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-200" />
            Checklist em Tempo Real
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium">
              Carregando prontuários do Serviço Social...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-gray-700 text-sm border-b">
                  <th className="p-5 font-semibold">ID / Atendimento</th>
                  <th className="p-5 font-semibold">Paciente & Leito</th>
                  <th className="p-5 font-semibold">Data Admissão</th>
                  <th className="p-5 font-semibold">Município de Origem</th>
                  <th className="p-5 font-semibold">Contato / Acompanhante</th>
                  <th className="p-5 font-semibold text-center bg-emerald-50/50">Checklist de Xerox (Documentos)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pacientes.map((p) => {
                  const docs = checklist[p.id] || {
                    tem_rg: false,
                    tem_cpf: false,
                    tem_sus: false,
                    tem_comprovante_residencia: false,
                  };
                  const todosCompletos = docs.tem_rg && docs.tem_cpf && docs.tem_sus && docs.tem_comprovante_residencia;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Coluna ID */}
                      <td className="p-5 font-mono text-xs font-bold text-slate-700">
                        <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {p.id_atendimento}
                        </span>
                      </td>

                      {/* Paciente e Leito */}
                      <td className="p-5">
                        <div className="font-bold text-gray-900 text-base">{p.usuario_nome}</div>
                        <div className="text-xs text-primary-blue font-semibold mt-0.5">{p.leito}</div>
                      </td>

                      {/* Admissão */}
                      <td className="p-5 text-gray-600">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {p.data_internacao ? new Date(p.data_internacao).toLocaleDateString("pt-BR") : "12/10/2026"}
                        </div>
                      </td>

                      {/* Município */}
                      <td className="p-5 text-gray-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          {p.municipio || "Arapiraca - AL"}
                        </div>
                      </td>

                      {/* Contato / Acompanhante */}
                      <td className="p-5 text-gray-600">
                        <div className="flex items-center gap-1.5 font-medium text-xs text-gray-800">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {p.acompanhante_nome || "Sem acompanhante"}
                        </div>
                        {p.visitante_ativo && (
                          <div className="text-xs text-emerald-600 mt-1 font-semibold">
                            Visitante atual: {p.visitante_ativo}
                          </div>
                        )}
                      </td>

                      {/* Checkboxes Interativos de Xerox */}
                      <td className="p-5 bg-emerald-50/30">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={docs.tem_rg}
                              onChange={() => toggleDocumento(p.id, "tem_rg")}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                            />
                            <span className={docs.tem_rg ? "text-emerald-800" : "text-gray-400"}>RG</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={docs.tem_cpf}
                              onChange={() => toggleDocumento(p.id, "tem_cpf")}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                            />
                            <span className={docs.tem_cpf ? "text-emerald-800" : "text-gray-400"}>CPF</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={docs.tem_sus}
                              onChange={() => toggleDocumento(p.id, "tem_sus")}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                            />
                            <span className={docs.tem_sus ? "text-emerald-800" : "text-gray-400"}>SUS</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={docs.tem_comprovante_residencia}
                              onChange={() => toggleDocumento(p.id, "tem_comprovante_residencia")}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                            />
                            <span className={docs.tem_comprovante_residencia ? "text-emerald-800" : "text-gray-400"}>
                              Comp. Resid.
                            </span>
                          </label>
                        </div>

                        <div className="text-center mt-2">
                          {todosCompletos ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              <FileCheck className="w-3 h-3" /> Pasta Completa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                              <FileX className="w-3 h-3" /> Pendente Xerox
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
