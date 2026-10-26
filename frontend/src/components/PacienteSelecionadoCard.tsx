"use client";

import React, { useMemo } from "react";
import { Paciente, Visitante } from "../services/api";
import CardVisitanteNoQuarto from "./CardVisitanteNoQuarto";
import { 
  UserCheck, 
  Phone, 
  FileText, 
  HeartHandshake, 
  Bed, 
  Hash, 
  UserPlus,
  ArrowLeftRight
} from "lucide-react";

interface PacienteSelecionadoCardProps {
  paciente: Paciente;
  onLiberarAcesso?: () => void;
  onOpenCheckIn?: (tipo?: 'visitante' | 'acompanhante') => void;
  onSaidaVisitante?: (pacienteId: number, visitanteId?: number) => void;
}

export default function PacienteSelecionadoCard({
  paciente,
  onLiberarAcesso,
  onOpenCheckIn,
  onSaidaVisitante,
}: PacienteSelecionadoCardProps) {
  // Dados do Acompanhante (prioriza objeto estruturado, fallback para propriedades do paciente)
  const acompNome = paciente.acompanhante?.nome || paciente.acompanhante_nome || "";
  const acompDoc = (paciente.acompanhante?.documento || paciente.acompanhante_documento || "").trim();
  const acompFone = (paciente.acompanhante?.telefone || paciente.acompanhante_telefone || "").trim();

  // Todos os acessos brutos
  const todosAcessos: Visitante[] = useMemo(() => {
    if (Array.isArray(paciente.visitantes) && paciente.visitantes.length > 0) {
      return paciente.visitantes;
    }
    if (paciente.visitante && paciente.visitante.nome) {
      return [paciente.visitante];
    }
    if (paciente.visitante_ativo) {
      return [{
        id: paciente.id * 1000 + 1,
        nome: paciente.visitante_ativo,
        documento: paciente.visitante_documento || null,
        telefone: paciente.visitante_telefone || null,
      }];
    }
    return [];
  }, [paciente.visitantes, paciente.visitante, paciente.visitante_ativo, paciente.visitante_documento, paciente.visitante_telefone, paciente.id]);

  // 1. Visitantes Sociais Normais de Quarto (EXCLUI Orelhinha e Procedimentos)
  const visitantesNormais: Visitante[] = useMemo(() => {
    return todosAcessos.filter((v) => {
      if (!v || !v.nome) return false;
      if (v.isProcedimento) return false;
      if (v.tipoAcesso && v.tipoAcesso !== 'VISITANTE') return false;
      if (v.nome.startsWith('Orelhinha:') || v.nome.startsWith('Óbito:')) return false;
      return true;
    });
  }, [todosAcessos]);

  const isVermelha = 
    paciente.setor_clinica?.toLowerCase().includes("vermelh") || 
    paciente.leito?.toLowerCase().includes("vermelh");
  const cotaMax = paciente.cota_maxima ?? (isVermelha ? 1 : 2);
  // Cota diária calculada APENAS sobre visitas normais de quarto!
  const cotasUsadas = paciente.cotas_usadas ?? (visitantesNormais.length > 0 ? visitantesNormais.length : 0);
  const cotaEsgotada = cotasUsadas >= cotaMax;

  return (
    <div className="mt-6 p-5 sm:p-6 bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-indigo-50/40 border-2 border-blue-200/80 rounded-2xl shadow-sm transition-all animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        
        {/* Informações Principais do Paciente */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold text-[#0A3D91] bg-white/90 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
              Paciente Selecionado
            </span>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              Atendimento: <strong className="text-slate-700">{paciente.id_atendimento}</strong>
            </span>
            {paciente.nome_mae && (
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                • Mãe: <strong className="text-slate-700">{paciente.nome_mae}</strong>
              </span>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            <span>{paciente.usuario_nome}</span>
            <span className="text-xs sm:text-sm font-bold text-[#0A3D91] bg-blue-100/80 border border-blue-300 px-3 py-0.5 rounded-lg flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />
              {paciente.leito}
            </span>
          </h3>

          {/* Grid de Detalhes: Acompanhante e Visitantes no Quarto */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Bloco 1: Acompanhante Atual */}
            <div className="bg-white/80 backdrop-blur-xs border border-purple-200/80 rounded-xl p-3 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <HeartHandshake className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  Acompanhante
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                  acompNome 
                    ? "bg-purple-100 text-purple-800 border border-purple-200" 
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {acompNome ? "Ativo 24h" : "Nenhum"}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-800 block truncate" title={acompNome || "Nenhum cadastrado"}>
                  {acompNome || "Nenhum acompanhante cadastrado"}
                </span>

                {/* Renderização Condicional de Documento e Telefone do Acompanhante */}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  {acompDoc ? (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                      <FileText className="w-3 h-3 text-slate-400" />
                      Doc: <strong className="text-slate-800">{acompDoc}</strong>
                    </span>
                  ) : null}

                  {acompFone ? (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      Tel: <strong className="text-slate-800">{acompFone}</strong>
                    </span>
                  ) : null}

                  {!acompDoc && !acompFone && acompNome ? (
                    <span className="text-[11px] text-slate-400 italic">Sem documento/telefone cadastrado</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Bloco 2: Visitante no Quarto (Filtrado estritamente para visitas sociais) */}
            <CardVisitanteNoQuarto
              visitantes={visitantesNormais}
              pacienteId={paciente.id}
              onSaidaVisitante={onSaidaVisitante ? (visId, pacId) => onSaidaVisitante(pacId ?? paciente.id, visId) : undefined}
            />

          </div>

          {/* Placar de Cotas Diárias (Exclusivo para Visitas Sociais) */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
              cotaEsgotada 
                ? "bg-red-100 text-red-800 border-red-300" 
                : "bg-emerald-100 text-emerald-800 border-emerald-300"
            }`}>
              Placar de Visitas Hoje: {cotasUsadas}/{cotaMax}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-[11px] text-slate-500">
              {cotaEsgotada ? "Cota esgotada para hoje" : "Vaga para visita disponível"}
            </span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="shrink-0 self-stretch sm:self-auto flex flex-wrap items-center gap-2">
          {onOpenCheckIn && (
            <>
              <button
                type="button"
                onClick={() => onOpenCheckIn('visitante')}
                className="bg-primary-green hover:bg-green-600 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Liberar Visitante</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCheckIn('acompanhante')}
                className="bg-[#0A3D91] hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Trocar Acomp.</span>
              </button>
            </>
          )}

          {onLiberarAcesso && (
            <button
              id="btn-liberar-acesso-card"
              type="button"
              onClick={onLiberarAcesso}
              className="w-full sm:w-auto bg-primary-green hover:bg-green-600 text-white font-bold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
            >
              <UserCheck className="w-5 h-5" />
              <span>Liberar Acesso / Check-in</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
