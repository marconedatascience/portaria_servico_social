import { describe, it, expect, beforeEach } from "vitest";
import { useOfflineQueueStore } from "../lib/sync/offlineQueue";
import { calcularDiffDemografico } from "../lib/sync/diff";
import type { OrelhinhaItem } from "../lib/schemas/orelhinha";

describe("Fila Offline e Diff de Sincronização Demográfica", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ itens: [] });
  });

  const itemBase: OrelhinhaItem = {
    id: 10,
    nome_rn: "RN de Clara",
    leito: "Leito 12",
    cartao_sus: "800000000000001",
    data_nascimento: "2026-10-20",
    sexo: "F",
    nome_mae: "Clara Santos",
    municipio: "Arapiraca",
    telefone: "82998765432",
    data_exame: "2026-10-28",
    horario: "09:00",
    status: "AGENDADO",
    versao: 1,
    atualizado_em: null,
  };

  describe("calcularDiffDemografico", () => {
    it("retorna objeto vazio se nenhum campo mudou", () => {
      const diff = calcularDiffDemografico(itemBase, {
        cartao_sus: "800000000000001",
        nome_mae: "Clara Santos",
        municipio: "Arapiraca",
        telefone: "82998765432",
      });
      expect(Object.keys(diff)).toHaveLength(0);
    });

    it("retorna somente os campos alterados", () => {
      const diff = calcularDiffDemografico(itemBase, {
        municipio: "Craíbas",
        telefone: "82988887777",
      });
      expect(diff).toEqual({
        municipio: "Craíbas",
        telefone: "82988887777",
      });
      expect(diff.cartao_sus).toBeUndefined();
      expect(diff.nome_mae).toBeUndefined();
    });
  });

  describe("Fila Offline Zustand (IndexedDB/Storage)", () => {
    it("enfileira com UUID único para operation_id e status pendente", () => {
      const store = useOfflineQueueStore.getState();
      const item1 = store.enfileirar(10, 1, { municipio: "Craíbas" });

      expect(item1.slotId).toBe(10);
      expect(item1.versaoBase).toBe(1);
      expect(item1.status).toBe("pendente");
      expect(item1.operationId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("marca como sincronizando e depois concluído", () => {
      const store = useOfflineQueueStore.getState();
      const item = store.enfileirar(10, 1, { telefone: "82999990000" });

      store.marcarSincronizando(item.id);
      expect(useOfflineQueueStore.getState().itens[0].status).toBe("sincronizando");

      store.marcarSincronizada(item.id);
      expect(useOfflineQueueStore.getState().itens[0].status).toBe("sincronizada");

      store.limparConcluidas();
      expect(useOfflineQueueStore.getState().itens).toHaveLength(0);
    });

    it("aplica backoff exponencial e registra erro em caso de falha transitória", () => {
      const store = useOfflineQueueStore.getState();
      const item = store.enfileirar(10, 1, { telefone: "82999990000" });

      store.marcarFalha(item.id, "Timeout de rede", 504);
      const atual = useOfflineQueueStore.getState().itens[0];

      expect(atual.status).toBe("falha");
      expect(atual.tentativas).toBe(1);
      expect(atual.ultimoErro).toBe("Timeout de rede");
      expect(atual.proximaTentativaEm).toBeGreaterThan(Date.now());
    });
  });
});
