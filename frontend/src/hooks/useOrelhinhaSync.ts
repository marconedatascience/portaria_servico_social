/**
 * Sincronização em tempo real e orquestrador de fila offline.
 * 1. Ouve eventos Realtime (Supabase / SSE) com fallback de polling (20s).
 * 2. Destaca linha por ~2s ao receber atualização remota e anuncia via aria-live.
 * 3. Processa fila offline da Portaria automaticamente ao restabelecer conexão.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CHAVE_QUERY_AGENDA } from "./useOrelhinhaAgenda";
import { useOfflineQueueStore } from "../lib/sync/offlineQueue";
import { patchDemografico, ErroConflitoVersao } from "../lib/api/orelhinhaClient";
import { supabase } from "../lib/supabase";

export function useOrelhinhaSync() {
  const queryClient = useQueryClient();
  const filaStore = useOfflineQueueStore();
  const [idsDestacados, setIdsDestacados] = useState<Set<number>>(new Set());
  const [mensagemAria, setMensagemAria] = useState<string>("");
  const [estaSincronizandoFila, setEstaSincronizandoFila] = useState(false);

  // Anúncio e destaque de linha remota
  const destacarLinhaRemota = useCallback((slotId: number, autor = "Fonoaudiologia") => {
    setIdsDestacados((prev) => new Set(prev).add(slotId));
    setMensagemAria(`Agenda atualizada por ${autor}.`);

    setTimeout(() => {
      setIdsDestacados((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
    }, 2200);
  }, []);

  // 1. Invalidação e push Realtime
  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;

    if (supabase) {
      try {
        canal = supabase
          .channel("realtime:agenda_orelhinha")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "agenda_orelhinha",
            },
            (payload) => {
              const novo = payload.new as { id?: number };
              if (novo?.id) {
                destacarLinhaRemota(novo.id);
              }
              queryClient.invalidateQueries({ queryKey: CHAVE_QUERY_AGENDA });
            },
          )
          .subscribe();
      } catch {
        // Fallback para polling se Realtime não conectar
      }
    }

    // Polling de fallback (20 segundos) caso Realtime esteja indisponível
    const intervaloPolling = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: CHAVE_QUERY_AGENDA });
      }
    }, 20000);

    return () => {
      if (canal) supabase.removeChannel(canal);
      clearInterval(intervaloPolling);
    };
  }, [queryClient, destacarLinhaRemota]);

  // 2. Processamento da fila offline em segundo plano
  const processarFila = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const pendentes = filaStore.itensPendentesParaSincronizacao();
    if (pendentes.length === 0) return;

    setEstaSincronizandoFila(true);

    for (const item of pendentes) {
      filaStore.marcarSincronizando(item.id);
      try {
        await patchDemografico(item.slotId, item.versaoBase, item.campos, item.operationId);
        filaStore.marcarSincronizada(item.id);
        queryClient.invalidateQueries({ queryKey: CHAVE_QUERY_AGENDA });
      } catch (err: unknown) {
        const status = err instanceof ErroConflitoVersao ? 409 : undefined;
        const msg = err instanceof Error ? err.message : "Erro de sincronização";
        filaStore.marcarFalha(item.id, msg, status);
      }
    }

    setEstaSincronizandoFila(false);
    filaStore.limparConcluidas();
  }, [filaStore, queryClient]);

  // Executa processamento da fila ao reconectar ou periodicamente
  useEffect(() => {
    const aoConectar = () => {
      processarFila();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", aoConectar);
    }

    const timerProcessamento = setInterval(processarFila, 8000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", aoConectar);
      }
      clearInterval(timerProcessamento);
    };
  }, [processarFila]);

  const pendenciasCount = filaStore.itens.filter(
    (it) => it.status === "pendente" || it.status === "sincronizando",
  ).length;

  return {
    idsDestacados,
    mensagemAria,
    destacarLinhaRemota,
    pendenciasCount,
    estaSincronizandoFila,
    processarFilaManualmente: processarFila,
  };
}
