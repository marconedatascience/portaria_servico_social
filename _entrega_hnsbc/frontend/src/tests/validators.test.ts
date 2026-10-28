import { describe, it, expect } from "vitest";
import {
  ehBissexto,
  diasNoMes,
  isoValido,
  brParaIso,
  isoParaBr,
  horaValida,
  somarDias,
} from "../lib/validators/calendario";
import { cnsValido, telefoneValido } from "../lib/validators/documentos";
import {
  validarDataExame,
  validarHoraExame,
  validarDemografico,
  somarDiasCalendario,
  type RegrasAgenda,
} from "../lib/schemas/orelhinha";

describe("Validadores de Calendário e Documentos Hospitalares", () => {
  describe("Calendário e Anos Bissextos", () => {
    it("identifica corretamente anos bissextos", () => {
      expect(ehBissexto(2024)).toBe(true);
      expect(ehBissexto(2028)).toBe(true);
      expect(ehBissexto(2000)).toBe(true);
      expect(ehBissexto(2023)).toBe(false);
      expect(ehBissexto(2025)).toBe(false);
      expect(ehBissexto(2026)).toBe(false);
      expect(ehBissexto(1900)).toBe(false);
    });

    it("calcula dias no mês corretamente", () => {
      expect(diasNoMes(2026, 1)).toBe(31);
      expect(diasNoMes(2026, 2)).toBe(28); // não bissexto
      expect(diasNoMes(2024, 2)).toBe(29); // bissexto
      expect(diasNoMes(2026, 4)).toBe(30);
    });

    it("rejeita 31/02 e datas inexistentes", () => {
      expect(isoValido("2026-02-31")).toBe(false);
      expect(isoValido("2026-02-29")).toBe(false);
      expect(isoValido("2024-02-29")).toBe(true); // bissexto
      expect(isoValido("2026-04-31")).toBe(false); // abril tem 30
      expect(brParaIso("31/02/2026")).toBeNull();
      expect(brParaIso("29/02/2024")).toBe("2024-02-29");
    });

    it("converte entre BR e ISO sem deslocamento de timezone", () => {
      expect(brParaIso("28/10/2026")).toBe("2026-10-28");
      expect(isoParaBr("2026-10-28")).toBe("28/10/2026");
      expect(somarDias("2026-10-28", 5)).toBe("2026-11-02");
      expect(somarDias("2026-10-28", -10)).toBe("2026-10-18");
    });

    it("valida horário HH:mm", () => {
      expect(horaValida("09:00")).toBe(true);
      expect(horaValida("23:59")).toBe(true);
      expect(horaValida("24:00")).toBe(false);
      expect(horaValida("12:60")).toBe(false);
    });
  });

  describe("Cartão SUS (CNS)", () => {
    it("valida CNS definitivo válido (inicia em 1 ou 2)", () => {
      expect(cnsValido("100000000000007")).toBe(true);
      expect(cnsValido("100000010000018")).toBe(true);
    });

    it("valida CNS provisório válido (inicia em 7, 8 ou 9)", () => {
      expect(cnsValido("800000000000001")).toBe(true);
      expect(cnsValido("700000000000005")).toBe(true);
    });

    it("rejeita CNS com dígito verificador errado ou tamanho incorreto", () => {
      expect(cnsValido("800000000000002")).toBe(false);
      expect(cnsValido("100000000000008")).toBe(false);
      expect(cnsValido("300000000000001")).toBe(false); // inicial 3 inválida
      expect(cnsValido("80000000000000")).toBe(false); // 14 dígitos
      expect(cnsValido("")).toBe(false);
    });
  });

  describe("Telefone", () => {
    it("valida telefones válidos com DDD correto", () => {
      expect(telefoneValido("82998765432")).toBe(true); // Celular Alagoas
      expect(telefoneValido("8235221234")).toBe(true); // Fixo Alagoas
      expect(telefoneValido("11912345678")).toBe(true); // Celular SP
    });

    it("rejeita telefones com formato ou DDD incorreto", () => {
      expect(telefoneValido("10998765432")).toBe(false); // DDD 10 inexistente
      expect(telefoneValido("08998765432")).toBe(false); // DDD 08 inexistente
      expect(telefoneValido("82898765432")).toBe(false); // Celular sem 9 inicial
      expect(telefoneValido("82998765")).toBe(false); // Curto
    });
  });

  describe("Schemas e Regras de Negócio", () => {
    const regras: RegrasAgenda = {
      retroatividade_dias: 7,
      janela_inicio: "08:00",
      janela_fim: "17:00",
      fuso: "America/Maceio",
    };

    const ctx = {
      regras,
      hoje: "2026-10-28",
      dataNascimento: "2026-10-20",
      somarDias: somarDiasCalendario,
    };

    it("rejeita data de exame antes do nascimento do recém-nascido", () => {
      const res = validarDataExame("19/10/2026", ctx);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.mensagem).toContain("não pode ser anterior ao nascimento");
      }
    });

    it("rejeita data de exame antes do limite de retroatividade (7 dias)", () => {
      const ctxRetro = { ...ctx, dataNascimento: "2026-10-01" };
      const res = validarDataExame("15/10/2026", ctxRetro);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.mensagem).toContain("anterior ao limite permitido");
      }
    });

    it("aceita data de exame válida", () => {
      const res = validarDataExame("28/10/2026", ctx);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.valor).toBe("2026-10-28");
      }
    });

    it("valida horário dentro da janela de atendimento", () => {
      expect(validarHoraExame("09:00", regras).ok).toBe(true);
      expect(validarHoraExame("17:00", regras).ok).toBe(true);

      const fora = validarHoraExame("07:30", regras);
      expect(fora.ok).toBe(false);
      if (!fora.ok) {
        expect(fora.mensagem).toContain("Fora da janela de atendimento");
      }
    });

    it("valida e normaliza payload demográfico", () => {
      const payload = {
        cartao_sus: "800.0000.0000.0001",
        nome_mae: "  Maria   Eduarda da Silva  ",
        municipio: "Arapiraca",
        telefone: "(82) 99876-5432",
      };

      const res = validarDemografico(payload);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.valor.cartao_sus).toBe("800000000000001"); // salvo sem máscara
        expect(res.valor.nome_mae).toBe("Maria Eduarda da Silva"); // trimmed & colapsado
        expect(res.valor.telefone).toBe("82998765432"); // sem máscara
      }
    });
  });
});
