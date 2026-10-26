"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Visitante } from "../services/api";

interface VisitasContextType {
  cotasPorPaciente: Record<number, number>;
  visitantesPorPaciente: Record<number, Visitante[]>;
  incrementarContadorVisitante: (pacienteId: number) => void;
  adicionarVisitante: (pacienteId: number, visitante: Visitante) => void;
  removerVisitante: (pacienteId: number, visitanteId: number) => void;
  obterContadorVisitantes: (pacienteId: number, fallback?: number) => number;
  obterVisitantes: (pacienteId: number, fallback?: Visitante[]) => Visitante[];
  setVisitantesIniciais: (pacienteId: number, visitantes: Visitante[], cotas?: number) => void;
}

const VisitasContext = createContext<VisitasContextType | undefined>(undefined);

export const VisitasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cotasPorPaciente, setCotasPorPaciente] = useState<Record<number, number>>({});
  const [visitantesPorPaciente, setVisitantesPorPaciente] = useState<Record<number, Visitante[]>>({});

  const incrementarContadorVisitante = useCallback((pacienteId: number) => {
    setCotasPorPaciente((prev) => ({
      ...prev,
      [pacienteId]: (prev[pacienteId] ?? 0) + 1,
    }));
  }, []);

  const adicionarVisitante = useCallback((pacienteId: number, visitante: Visitante) => {
    // Apenas visitantes de visita social incrementam o contador de visitantes
    const ehSocial = !visitante.isProcedimento && visitante.tipoAcesso !== "ORELHINHA";

    setVisitantesPorPaciente((prev) => {
      const listaAtual = prev[pacienteId] || [];
      return {
        ...prev,
        [pacienteId]: [...listaAtual, visitante],
      };
    });

    if (ehSocial) {
      incrementarContadorVisitante(pacienteId);
    }
  }, [incrementarContadorVisitante]);

  const removerVisitante = useCallback((pacienteId: number, visitanteId: number) => {
    setVisitantesPorPaciente((prev) => {
      const listaAtual = prev[pacienteId] || [];
      return {
        ...prev,
        [pacienteId]: listaAtual.filter((v) => v.id !== visitanteId),
      };
    });
  }, []);

  const obterContadorVisitantes = useCallback((pacienteId: number, fallback = 0) => {
    return cotasPorPaciente[pacienteId] ?? fallback;
  }, [cotasPorPaciente]);

  const obterVisitantes = useCallback((pacienteId: number, fallback: Visitante[] = []) => {
    return visitantesPorPaciente[pacienteId] ?? fallback;
  }, [visitantesPorPaciente]);

  const setVisitantesIniciais = useCallback((pacienteId: number, visitantes: Visitante[], cotas?: number) => {
    setVisitantesPorPaciente((prev) => ({
      ...prev,
      [pacienteId]: visitantes,
    }));
    if (cotas !== undefined) {
      setCotasPorPaciente((prev) => ({
        ...prev,
        [pacienteId]: cotas,
      }));
    }
  }, []);

  return (
    <VisitasContext.Provider
      value={{
        cotasPorPaciente,
        visitantesPorPaciente,
        incrementarContadorVisitante,
        adicionarVisitante,
        removerVisitante,
        obterContadorVisitantes,
        obterVisitantes,
        setVisitantesIniciais,
      }}
    >
      {children}
    </VisitasContext.Provider>
  );
};

export function useVisitasStore(): VisitasContextType {
  const context = useContext(VisitasContext);
  if (!context) {
    throw new Error("useVisitasStore deve ser usado dentro de um VisitasProvider");
  }
  return context;
}
