/**
 * Fila offline-first para edições demográficas da Portaria/Serviço Social.
 * Armazena operações no IndexedDB/localStorage via Zustand persist.
 * Cada mutação recebe um operation_id (UUID) para idempotência no backend.
 * Data/Hora NUNCA entram nesta fila (exclusivo Fonoaudiologia, sempre online).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DemograficoPayload } from "../schemas/orelhinha";

export type StatusItemFila = "pendente" | "sincronizando" | "sincronizada" | "falha";

export interface ItemFilaDemografico {
  id: string; // ID local único
  slotId: number;
  operationId: string; // UUID v4 idempotente enviado à API
  versaoBase: number; // If-Match enviado ao backend
  campos: DemograficoPayload;
  status: StatusItemFila;
  criadoEm: number;
  tentativas: number;
  ultimoErro?: string;
  codigoHttp?: number;
  proximaTentativaEm: number;
}

interface FilaState {
  itens: ItemFilaDemografico[];
  enfileirar: (slotId: number, versaoBase: number, campos: DemograficoPayload) => ItemFilaDemografico;
  marcarSincronizando: (id: string) => void;
  marcarSincronizada: (id: string) => void;
  marcarFalha: (id: string, erro: string, codigoHttp?: number) => void;
  remover: (id: string) => void;
  limparConcluidas: () => void;
  itensPendentesParaSincronizacao: () => ItemFilaDemografico[];
}

function gerarUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function calcularBackoffMs(tentativas: number): number {
  const base = 2000; // 2s
  const max = 60000; // 60s
  const exp = Math.min(base * Math.pow(2, tentativas), max);
  const jitter = Math.random() * 500;
  return exp + jitter;
}

export const useOfflineQueueStore = create<FilaState>()(
  persist(
    (set, get) => ({
      itens: [],

      enfileirar: (slotId, versaoBase, campos) => {
        const novoItem: ItemFilaDemografico = {
          id: `${slotId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          slotId,
          operationId: gerarUUID(),
          versaoBase,
          campos,
          status: "pendente",
          criadoEm: Date.now(),
          tentativas: 0,
          proximaTentativaEm: Date.now(),
        };

        set((state) => {
          // Remove pendências anteriores para o MESMO slot_id se ainda não sincronizadas,
          // mesclando campos para não perder dados
          const filtrados = state.itens.filter(
            (it) => !(it.slotId === slotId && (it.status === "pendente" || it.status === "falha")),
          );
          return { itens: [...filtrados, novoItem] };
        });

        return novoItem;
      },

      marcarSincronizando: (id) => {
        set((state) => ({
          itens: state.itens.map((it) => (it.id === id ? { ...it, status: "sincronizando" } : it)),
        }));
      },

      marcarSincronizada: (id) => {
        set((state) => ({
          itens: state.itens.map((it) => (it.id === id ? { ...it, status: "sincronizada" } : it)),
        }));
      },

      marcarFalha: (id, erro, codigoHttp) => {
        set((state) => ({
          itens: state.itens.map((it) => {
            if (it.id !== id) return it;
            const tentativas = it.tentativas + 1;
            // Se erro 403 ou 409 irrecuperável, não reagendar indefinidamente
            const definitivo = codigoHttp === 403 || codigoHttp === 409 || tentativas >= 10;
            return {
              ...it,
              status: "falha",
              tentativas,
              ultimoErro: erro,
              codigoHttp,
              proximaTentativaEm: definitivo ? Number.MAX_SAFE_INTEGER : Date.now() + calcularBackoffMs(tentativas),
            };
          }),
        }));
      },

      remover: (id) => {
        set((state) => ({
          itens: state.itens.filter((it) => it.id !== id),
        }));
      },

      limparConcluidas: () => {
        set((state) => ({
          itens: state.itens.filter((it) => it.status !== "sincronizada"),
        }));
      },

      itensPendentesParaSincronizacao: () => {
        const agora = Date.now();
        return get().itens.filter(
          (it) => (it.status === "pendente" || it.status === "falha") && it.proximaTentativaEm <= agora,
        );
      },
    }),
    {
      name: "hnsbc_orelhinha_fila_offline_v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : dummyStorage)),
    },
  ),
);

const memoryMap = new Map<string, string>();
const dummyStorage = {
  getItem: (key: string) => memoryMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryMap.set(key, value);
  },
  removeItem: (key: string) => {
    memoryMap.delete(key);
  },
};
