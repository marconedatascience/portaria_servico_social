"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { SlotOrelhinha } from "../services/api";

export interface ConsultaOrelhinhaItem {
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

const CONSULTAS_INICIAIS: ConsultaOrelhinhaItem[] = [
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
];

interface OrelhinhaContextType {
  consultas: ConsultaOrelhinhaItem[];
  slots: SlotOrelhinha[];
  adicionarConsultaOrelhinha: (consulta: Omit<ConsultaOrelhinhaItem, "id">) => ConsultaOrelhinhaItem;
  atualizarConsultaOrelhinha: (id: number, atualizacao: Partial<ConsultaOrelhinhaItem>) => void;
  removerConsultaOrelhinha: (id: number) => void;
  liberarAcessoOrelhinhaSlot: (slotId: number) => void;
  totalAgendados: number;
  totalRealizados: number;
  totalFalhas: number;
}

const OrelhinhaContext = createContext<OrelhinhaContextType | undefined>(undefined);

export const OrelhinhaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consultas, setConsultas] = useState<ConsultaOrelhinhaItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem("fono_consultas_lista");
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error("Erro ao recuperar consultas da Orelhinha:", err);
      }
    }
    return CONSULTAS_INICIAIS;
  });

  const [slots, setSlots] = useState<SlotOrelhinha[]>([]);

  // Salva no localStorage quando consultas forem alteradas
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fono_consultas_lista", JSON.stringify(consultas));
    }
  }, [consultas]);

  // Ações da Orelhinha: NENHUMA delas dispara atualização no contador de visitantes
  const adicionarConsultaOrelhinha = useCallback((nova: Omit<ConsultaOrelhinhaItem, "id">) => {
    const novoItem: ConsultaOrelhinhaItem = {
      ...nova,
      id: Date.now() + Math.floor(Math.random() * 1000),
    };
    setConsultas((prev) => [novoItem, ...prev]);
    return novoItem;
  }, []);

  const atualizarConsultaOrelhinha = useCallback((id: number, atualizacao: Partial<ConsultaOrelhinhaItem>) => {
    setConsultas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...atualizacao } : c))
    );
  }, []);

  const removerConsultaOrelhinha = useCallback((id: number) => {
    setConsultas((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const liberarAcessoOrelhinhaSlot = useCallback((slotId: number) => {
    // Isolamento: altera apenas o status do slot de orelhinha, sem afetar cotas de visitantes
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "LIBERADO" } : s))
    );
  }, []);

  const totalAgendados = consultas.filter((c) => c.status === "Agendado" || c.status === "Reagendado").length;
  const totalRealizados = consultas.filter((c) => c.status === "Realizado").length;
  const totalFalhas = consultas.filter((c) => c.status === "Falha / Re-teste").length;

  return (
    <OrelhinhaContext.Provider
      value={{
        consultas,
        slots,
        adicionarConsultaOrelhinha,
        atualizarConsultaOrelhinha,
        removerConsultaOrelhinha,
        liberarAcessoOrelhinhaSlot,
        totalAgendados,
        totalRealizados,
        totalFalhas,
      }}
    >
      {children}
    </OrelhinhaContext.Provider>
  );
};

export function useOrelhinhaStore(): OrelhinhaContextType {
  const context = useContext(OrelhinhaContext);
  if (!context) {
    throw new Error("useOrelhinhaStore deve ser usado dentro de um OrelhinhaProvider");
  }
  return context;
}
