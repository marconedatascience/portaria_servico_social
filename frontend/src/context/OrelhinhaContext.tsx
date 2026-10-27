"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { SlotOrelhinha } from "../services/api";
import { supabase } from "../lib/supabase";
import { maskCartaoSUS, maskDate, maskTime, maskPhone } from "../utils/masks";

export interface ConsultaOrelhinhaItem {
  id: number;
  // Campos da Tabela (UI/UX Clean Hospitalar)
  cartaoSus?: string;       // 15 dígitos: 000.0000.0000.0000
  dataNascimento?: string;  // DD/MM/YYYY
  sexo?: "F" | "M";         // F ou M
  nomeMae?: string;         // Nome da Mãe do RN
  municipio?: string;       // Município de residência (ex: Arapiraca)
  telefone?: string;        // (00) 9.0000-0000
  data: string;            // Data do Exame: DD/MM/YYYY (Exclusivo Fonoaudiólogo)
  horario: string;         // Hora do Exame: HH:mm (Exclusivo Fonoaudiólogo)

  // Metadados clínicos e de atendimento
  paciente: string;        // Identificação do RN (ex: RN de Maria Eduarda)
  leito: string;           // Leito/Setor (ex: Maternidade 03)
  responsavel: string;     // Responsável legal
  status: "Agendado" | "Realizado" | "Reagendado" | "Cancelado" | "Falha / Re-teste" | "Ausente";
  presenca?: "Presente" | "Ausente" | "Pendente";
  checkinPortaria?: boolean;
  checkinHorario?: string;
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
    cartaoSus: maskCartaoSUS("898001234567890"),
    dataNascimento: maskDate("20/10/2026"),
    sexo: "F",
    nomeMae: "Maria Eduarda da Silva",
    municipio: "Arapiraca",
    telefone: maskPhone("82998765432"),
    paciente: "RN de Maria Eduarda",
    leito: "Maternidade 03",
    responsavel: "Maria Eduarda da Silva (Mãe)",
    data: "28/10/2026",
    horario: "09:00",
    status: "Agendado",
    presenca: "Pendente",
    checkinPortaria: false,
    observacoes: "Recém-nascido a termo, 39 semanas, parto normal.",
  },
  {
    id: 2,
    cartaoSus: maskCartaoSUS("723004561234891"),
    dataNascimento: maskDate("22/10/2026"),
    sexo: "M",
    nomeMae: "Camila Santos Ferreira",
    municipio: "Craíbas",
    telefone: maskPhone("82987123456"),
    paciente: "RN de Camila Santos",
    leito: "Berçário 02",
    responsavel: "Lucas Santos (Pai)",
    data: "28/10/2026",
    horario: "10:30",
    status: "Agendado",
    presenca: "Pendente",
    checkinPortaria: true,
    checkinHorario: "10:15",
    observacoes: "Aguardando despertar para realização do teste.",
  },
  {
    id: 3,
    cartaoSus: maskCartaoSUS("910009876543210"),
    dataNascimento: maskDate("19/10/2026"),
    sexo: "F",
    nomeMae: "Beatriz Lima Alencar",
    municipio: "Girau do Ponciano",
    telefone: maskPhone("82991238877"),
    paciente: "RN de Beatriz Lima",
    leito: "Maternidade 07",
    responsavel: "Beatriz Lima Alencar (Mãe)",
    data: "28/10/2026",
    horario: "14:00",
    status: "Realizado",
    presenca: "Presente",
    checkinPortaria: true,
    checkinHorario: "13:45",
    resultadoGeral: "Passou (Normal bilateral)",
    orelhaDireita: "Passou",
    orelhaEsquerda: "Passou",
    fonoaudiologo: "Dra. Juliana Ribeiro",
    crfa: "CRFa 4-8921",
    dataRegistro: "28/10/2026 14:22",
    conduta: "Alta da triagem auditiva neonatal com orientações aos pais.",
    observacoes: "EOA presentes e reprodutíveis bilateralmente em ambiente silencioso.",
  },
  {
    id: 4,
    cartaoSus: maskCartaoSUS("845003322114455"),
    dataNascimento: maskDate("21/10/2026"),
    sexo: "M",
    nomeMae: "Juliana Costa Mendes",
    municipio: "Feira Grande",
    telefone: maskPhone("82988443322"),
    paciente: "RN de Juliana Costa",
    leito: "Berçário 04",
    responsavel: "Juliana Costa Mendes (Mãe)",
    data: "29/10/2026",
    horario: "08:30",
    status: "Agendado",
    presenca: "Pendente",
    checkinPortaria: false,
    observacoes: "Sem intercorrências no parto. Aguardando alta conjunta.",
  },
  {
    id: 5,
    cartaoSus: maskCartaoSUS("756008899001122"),
    dataNascimento: maskDate("18/10/2026"),
    sexo: "F",
    nomeMae: "Sandra Liberal Soares",
    municipio: "Lagoa da Canoa",
    telefone: maskPhone("82996554433"),
    paciente: "RN de Sandra Liberal",
    leito: "Maternidade 01",
    responsavel: "Sandra Liberal Soares (Mãe)",
    data: "29/10/2026",
    horario: "11:15",
    status: "Agendado",
    presenca: "Pendente",
    checkinPortaria: false,
    observacoes: "Encaminhada pela equipe da maternidade para triagem auditiva.",
  },
];

interface OrelhinhaContextType {
  consultas: ConsultaOrelhinhaItem[];
  slots: SlotOrelhinha[];
  adicionarConsultaOrelhinha: (consulta: Omit<ConsultaOrelhinhaItem, "id">) => ConsultaOrelhinhaItem;
  atualizarConsultaOrelhinha: (id: number, atualizacao: Partial<ConsultaOrelhinhaItem>) => void;
  removerConsultaOrelhinha: (id: number) => void;
  realizarCheckin: (id: number) => void;
  liberarAcessoOrelhinhaSlot: (slotId: number) => void;
  sincronizarEmTempoReal: () => void;
  totalAgendados: number;
  totalRealizados: number;
  totalFalhas: number;
}

const OrelhinhaContext = createContext<OrelhinhaContextType | undefined>(undefined);

export const OrelhinhaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consultas, setConsultas] = useState<ConsultaOrelhinhaItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem("fono_consultas_lista_v2");
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

  // Salva no localStorage e dispara evento de sincronização entre abas
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fono_consultas_lista_v2", JSON.stringify(consultas));
    }
  }, [consultas]);

  // Sincronização em tempo real (Supabase Channel + Focus + Storage)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Sincronização instantânea ao alternar abas / focar na janela (Window Focus)
    const handleFocus = () => {
      try {
        const salvo = localStorage.getItem("fono_consultas_lista_v2");
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConsultas(parsed);
          }
        }
      } catch (e) {
        console.warn("Erro no refetch ao focar janela:", e);
      }
    };

    // 2. Sincronização cruzada entre abas (Storage Event)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "fono_consultas_lista_v2" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setConsultas(parsed);
          }
        } catch {
          // Ignora parsing errors
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    // 3. Supabase Realtime Channel
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("slots_orelhinha_realtime")
        .on(
          "broadcast",
          { event: "SYNC_ORELHINHA" },
          (payload: { payload?: { consultas?: ConsultaOrelhinhaItem[] } }) => {
            if (payload?.payload?.consultas && Array.isArray(payload.payload.consultas)) {
              setConsultas(payload.payload.consultas);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Supabase realtime channel não disponível em modo offline/mock:", err);
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, []);

  const sincronizarEmTempoReal = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem("fono_consultas_lista_v2");
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConsultas(parsed);
          }
        }
      } catch (e) {
        console.error("Erro na sincronização manual:", e);
      }
    }
  }, []);

  // Adicionar consulta
  const adicionarConsultaOrelhinha = useCallback((nova: Omit<ConsultaOrelhinhaItem, "id">) => {
    const novoItem: ConsultaOrelhinhaItem = {
      ...nova,
      id: Date.now() + Math.floor(Math.random() * 1000),
      cartaoSus: maskCartaoSUS(nova.cartaoSus || ""),
      dataNascimento: maskDate(nova.dataNascimento || ""),
      telefone: maskPhone(nova.telefone || ""),
      data: maskDate(nova.data || ""),
      horario: maskTime(nova.horario || ""),
    };

    setConsultas((prev) => {
      const atualizada = [novoItem, ...prev];
      if (typeof window !== "undefined") {
        localStorage.setItem("fono_consultas_lista_v2", JSON.stringify(atualizada));
      }
      return atualizada;
    });

    // Notifica Supabase Realtime
    try {
      supabase.channel("slots_orelhinha_realtime").send({
        type: "broadcast",
        event: "SYNC_ORELHINHA",
        payload: { acao: "INSERT", item: novoItem },
      });
    } catch {
      // Broadcast silently
    }

    return novoItem;
  }, []);

  // Atualizar consulta
  const atualizarConsultaOrelhinha = useCallback((id: number, atualizacao: Partial<ConsultaOrelhinhaItem>) => {
    setConsultas((prev) => {
      const atualizada = prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          ...atualizacao,
          cartaoSus: atualizacao.cartaoSus ? maskCartaoSUS(atualizacao.cartaoSus) : c.cartaoSus,
          dataNascimento: atualizacao.dataNascimento ? maskDate(atualizacao.dataNascimento) : c.dataNascimento,
          telefone: atualizacao.telefone ? maskPhone(atualizacao.telefone) : c.telefone,
          data: atualizacao.data ? maskDate(atualizacao.data) : c.data,
          horario: atualizacao.horario ? maskTime(atualizacao.horario) : c.horario,
        };
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("fono_consultas_lista_v2", JSON.stringify(atualizada));
      }

      // Notifica em tempo real (reflete instantaneamente na Portaria / Serviço Social)
      try {
        supabase.channel("slots_orelhinha_realtime").send({
          type: "broadcast",
          event: "SYNC_ORELHINHA",
          payload: { acao: "UPDATE", id, atualizacao, consultas: atualizada },
        });
      } catch {
        // Silently catch in offline mode
      }

      return atualizada;
    });
  }, []);

  // Check-in na Portaria
  const realizarCheckin = useCallback((id: number) => {
    const agoraHora = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setConsultas((prev) => {
      const atualizada = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              checkinPortaria: true,
              checkinHorario: agoraHora,
              presenca: (c.presenca === "Ausente" ? "Ausente" : "Presente") as ConsultaOrelhinhaItem["presenca"],
            }
          : c
      );

      if (typeof window !== "undefined") {
        localStorage.setItem("fono_consultas_lista_v2", JSON.stringify(atualizada));
      }

      try {
        supabase.channel("slots_orelhinha_realtime").send({
          type: "broadcast",
          event: "SYNC_ORELHINHA",
          payload: { acao: "CHECKIN", id, horario: agoraHora, consultas: atualizada },
        });
      } catch {
        // Silently catch
      }

      return atualizada;
    });
  }, []);

  const removerConsultaOrelhinha = useCallback((id: number) => {
    setConsultas((prev) => {
      const atualizada = prev.filter((c) => c.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem("fono_consultas_lista_v2", JSON.stringify(atualizada));
      }
      return atualizada;
    });
  }, []);

  const liberarAcessoOrelhinhaSlot = useCallback((slotId: number) => {
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
        realizarCheckin,
        liberarAcessoOrelhinhaSlot,
        sincronizarEmTempoReal,
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
