/**
 * Hook central de dados para a Agenda da Orelhinha.
 * Suporta updates otimistas para Fono (online com rollback) e
 * gravação demográfica da Portaria/Social com fila offline resiliente.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAgenda, patchAgenda, patchDemografico, ErroConflitoVersao } from "../lib/api/orelhinhaClient";
import { useOfflineQueueStore } from "../lib/sync/offlineQueue";
import { calcularDiffDemografico } from "../lib/sync/diff";
import type { AgendaResponse, OrelhinhaItem, AgendaPayload, DemograficoPayload } from "../lib/schemas/orelhinha";

export const CHAVE_QUERY_AGENDA = ["orelhinha", "agenda"] as const;

export function useOrelhinhaAgenda() {
  const queryClient = useQueryClient();
  const filaOffline = useOfflineQueueStore();

  const query = useQuery({
    queryKey: CHAVE_QUERY_AGENDA,
    queryFn: fetchAgenda,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Mutação para Fonoaudiologia: SOMENTE ONLINE, lock otimista com rollback
  const mutacaoAgenda = useMutation({
    mutationFn: async ({
      slotId,
      versao,
      payload,
    }: {
      slotId: number;
      versao: number;
      payload: AgendaPayload;
    }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("A Fonoaudiologia só pode alterar a agenda em modo online.");
      }
      return patchAgenda(slotId, versao, payload);
    },
    onMutate: async ({ slotId, payload }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_QUERY_AGENDA });
      const anterior = queryClient.getQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA);

      if (anterior) {
        queryClient.setQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA, {
          ...anterior,
          itens: anterior.itens.map((it) => (it.id === slotId ? { ...it, ...payload } : it)),
        });
      }

      return { anterior };
    },
    onError: (err, _vars, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(CHAVE_QUERY_AGENDA, context.anterior);
      }
    },
    onSuccess: (resultado) => {
      // Atualiza o item exato com a nova versão
      queryClient.setQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA, (velho) => {
        if (!velho) return velho;
        return {
          ...velho,
          itens: velho.itens.map((it) => (it.id === resultado.item.id ? resultado.item : it)),
        };
      });
    },
  });

  // Mutação para Portaria/Social: Demográfico com fila offline
  const mutacaoDemografico = useMutation({
    mutationFn: async ({
      slotId,
      itemOriginal,
      novosValores,
    }: {
      slotId: number;
      itemOriginal: OrelhinhaItem;
      novosValores: DemograficoPayload;
    }) => {
      const diff = calcularDiffDemografico(itemOriginal, novosValores);
      if (Object.keys(diff).length === 0) {
        return { item: itemOriginal, reaplicada: false, semAlteracao: true };
      }

      const estaOnline = typeof navigator === "undefined" || navigator.onLine;

      // Se estiver offline, enfileira diretamente
      if (!estaOnline) {
        filaOffline.enfileirar(slotId, itemOriginal.versao, diff);
        return {
          item: { ...itemOriginal, ...diff },
          reaplicada: false,
          offline: true,
        };
      }

      // Se online, tenta enviar com operation_id único
      const itemFila = filaOffline.enfileirar(slotId, itemOriginal.versao, diff);
      filaOffline.marcarSincronizando(itemFila.id);

      try {
        const res = await patchDemografico(slotId, itemOriginal.versao, diff, itemFila.operationId);
        filaOffline.marcarSincronizada(itemFila.id);
        return { item: res.item, reaplicada: res.reaplicada, offline: false };
      } catch (err: unknown) {
        const status = err instanceof ErroConflitoVersao ? 409 : undefined;
        const msg = err instanceof Error ? err.message : "Falha na sincronização";
        filaOffline.marcarFalha(itemFila.id, msg, status);
        throw err;
      }
    },
    onMutate: async ({ slotId, novosValores }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_QUERY_AGENDA });
      const anterior = queryClient.getQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA);

      if (anterior) {
        queryClient.setQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA, {
          ...anterior,
          itens: anterior.itens.map((it) => (it.id === slotId ? { ...it, ...novosValores } : it)),
        });
      }

      return { anterior };
    },
    onError: (err, _vars, context) => {
      // Se não for offline, e der erro grave diferente de enfileirado, pode dar rollback
      if (typeof navigator !== "undefined" && navigator.onLine && !(err instanceof ErroConflitoVersao)) {
        if (context?.anterior) {
          queryClient.setQueryData(CHAVE_QUERY_AGENDA, context.anterior);
        }
      }
    },
    onSuccess: (resultado) => {
      if (resultado.item) {
        queryClient.setQueryData<AgendaResponse>(CHAVE_QUERY_AGENDA, (velho) => {
          if (!velho) return velho;
          return {
            ...velho,
            itens: velho.itens.map((it) => (it.id === resultado.item.id ? resultado.item : it)),
          };
        });
      }
    },
  });

  return {
    ...query,
    itens: query.data?.itens ?? [],
    permissoesCampos: query.data?.permissoes_campos ?? [],
    regras: query.data?.regras,
    mutacaoAgenda,
    mutacaoDemografico,
  };
}
