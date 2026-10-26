"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Baby, Bed, Check, X, Loader2, HeartHandshake } from "lucide-react";
import { Paciente, fetchPacientes } from "../services/api";

interface AutoCompleteRNPacienteProps {
  value: string;
  onChangeValue: (val: string) => void;
  onSelect: (paciente: Paciente) => void;
  onClear?: () => void;
  placeholder?: string;
}

export default function AutoCompleteRNPaciente({
  value,
  onChangeValue,
  onSelect,
  onClear,
  placeholder = "Digite o nome do recém-nascido ou mãe...",
}: AutoCompleteRNPacienteProps) {
  const [query, setQuery] = useState(value);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza query interna se o valor externo mudar
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Carrega a lista de pacientes internados da API
  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setCarregando(true);
      try {
        const dados = await fetchPacientes();
        if (ativo && Array.isArray(dados)) {
          setPacientes(dados);
        }
      } catch (err) {
        console.error("Erro ao carregar pacientes para o autocomplete:", err);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtra opções com base no texto digitado
  const resultados = query.trim()
    ? pacientes.filter((p) => {
        const q = query.toLowerCase();
        const nomeMae = p.nome_mae || (p as unknown as { nomeMae?: string }).nomeMae || "";
        return (
          p.usuario_nome?.toLowerCase().includes(q) ||
          nomeMae.toLowerCase().includes(q) ||
          p.leito?.toLowerCase().includes(q) ||
          p.id_atendimento?.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  const handleSelectOption = (paciente: Paciente) => {
    setQuery(paciente.usuario_nome);
    onChangeValue(paciente.usuario_nome);
    onSelect(paciente);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChangeValue("");
    if (onClear) onClear();
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-purple-600 pointer-events-none flex items-center justify-center">
          {carregando ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          ) : (
            <Baby className="w-4 h-4 text-purple-600" />
          )}
        </div>

        <input
          type="text"
          required
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChangeValue(val);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-gray-800 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100 font-medium text-sm transition-all shadow-2xs"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Limpar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown de opções formatadas como 'Nome do RN - Leito' */}
      {isOpen && resultados.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-purple-100 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {resultados.map((p) => {
            const nomeMae = p.nome_mae || (p as unknown as { nomeMae?: string }).nomeMae;
            const formatoRotulo = `${p.usuario_nome} - ${p.leito}`;

            return (
              <li
                key={p.id}
                onClick={() => handleSelectOption(p)}
                className="p-3 hover:bg-purple-50/80 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                    <Baby className="w-4 h-4" />
                  </div>
                  <div>
                    {/* Formato obrigatório: 'Nome do RN - Leito' */}
                    <div className="font-bold text-sm text-slate-900 group-hover:text-purple-900 transition-colors flex items-center gap-1.5">
                      <span>{formatoRotulo}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      {nomeMae && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <HeartHandshake className="w-3 h-3 text-pink-500" />
                          Mãe: {nomeMae}
                        </span>
                      )}
                      {p.setor_clinica && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                          {p.setor_clinica}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity pl-2 shrink-0">
                  <Check className="w-4 h-4" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isOpen && query.trim().length > 1 && resultados.length === 0 && !carregando && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 p-3 bg-white rounded-xl shadow-lg border border-slate-200 text-xs text-slate-500 text-center">
          Nenhum paciente internado encontrado com &quot;{query}&quot;.
        </div>
      )}
    </div>
  );
}
