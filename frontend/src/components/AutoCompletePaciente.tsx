"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, User, Bed, ArrowRight, X, Users, HeartHandshake } from "lucide-react";
import { Paciente } from "../services/api";

interface AutoCompletePacienteProps {
  pacientes: Paciente[];
  onSelect: (paciente: Paciente) => void;
  placeholder?: string;
}

export default function AutoCompletePaciente({
  pacientes,
  onSelect,
  placeholder = "Busca Unificada: Digite o Nome do Paciente, Nome da Mãe ou Leito..."
}: AutoCompletePacienteProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resultados = query.trim()
    ? pacientes.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.usuario_nome?.toLowerCase().includes(q) ||
          p.nome_mae?.toLowerCase().includes(q) ||
          p.leito?.toLowerCase().includes(q) ||
          p.id_atendimento?.toLowerCase().includes(q) ||
          p.acompanhante_nome?.toLowerCase().includes(q) ||
          p.visitante_ativo?.toLowerCase().includes(q)
        );
      }).slice(0, 8)
    : [];

  const handleSelect = (paciente: Paciente) => {
    setQuery(`${paciente.usuario_nome} (${paciente.leito})`);
    setIsOpen(false);
    onSelect(paciente);
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 bg-white border-2 border-slate-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:border-primary-blue focus:ring-4 focus:ring-blue-100 outline-none text-base font-medium shadow-sm transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 p-1.5 rounded-full hover:bg-slate-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            title="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && resultados.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100">
          {resultados.map((p) => {
            const isVermelha = p.setor_clinica?.toLowerCase().includes("vermelh") || p.leito?.toLowerCase().includes("vermelh");
            const cotaMax = isVermelha ? 1 : 2;
            const cotasUsadas = p.cotas_usadas ?? (p.visitante_ativo ? 1 : 0);
            const cotaEsgotada = cotasUsadas >= cotaMax;

            return (
              <li
                key={p.id}
                onClick={() => handleSelect(p)}
                className="p-4 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                    isVermelha ? "bg-red-100 text-red-700" : "bg-blue-100 text-primary-blue"
                  }`}>
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900 text-base group-hover:text-primary-blue transition-colors">
                        {p.usuario_nome}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                        isVermelha ? "bg-red-100 text-red-800 border border-red-200" : "bg-blue-100 text-primary-blue border border-blue-200"
                      }`}>
                        <Bed className="h-3 w-3" />
                        {p.leito}
                      </span>
                      {/* Placar de Cotas do Paciente */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                        cotaEsgotada
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}>
                        <Users className="h-3 w-3" />
                        Visitantes: {cotasUsadas}/{cotaMax}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Atendimento: <strong>{p.id_atendimento}</strong></span>
                      {p.nome_mae && (
                        <span className="text-slate-600 flex items-center gap-1">
                          <HeartHandshake className="w-3 h-3 text-pink-500" />
                          Mãe: <strong>{p.nome_mae}</strong>
                        </span>
                      )}
                      {p.acompanhante_nome && (
                        <span>Acompanhante: <strong className="text-gray-700">{p.acompanhante_nome}</strong></span>
                      )}
                      {p.visitante_ativo && (
                        <span className="text-emerald-700 font-semibold">
                          Visitante Atual: {p.visitante_ativo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-primary-blue group-hover:translate-x-1 transition-all shrink-0 ml-3" />
              </li>
            );
          })}
        </ul>
      )}

      {isOpen && query.trim() && resultados.length === 0 && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center text-gray-500 animate-in fade-in">
          Nenhum paciente localizado para o termo &ldquo;<strong>{query}</strong>&rdquo;. Tente buscar por Nome, Mãe ou Leito.
        </div>
      )}
    </div>
  );
}
