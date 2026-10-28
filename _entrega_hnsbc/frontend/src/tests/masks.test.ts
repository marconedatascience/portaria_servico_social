import { describe, it, expect } from "vitest";
import {
  maskCartaoSus,
  maskData,
  maskHora,
  maskTelefone,
  unmask,
  aplicarMascara,
} from "../lib/masks";

describe("Máscaras puras do módulo Orelhinha", () => {
  describe("unmask", () => {
    it("remove caracteres não numéricos", () => {
      expect(unmask("123.456.789-00")).toBe("12345678900");
      expect(unmask("(82) 99876-5432")).toBe("82998765432");
      expect(unmask("abc 12 def 34")).toBe("1234");
      expect(unmask("")).toBe("");
    });
  });

  describe("maskCartaoSus (15 dígitos: 000.0000.0000.0000)", () => {
    it("formata digitação progressiva", () => {
      expect(maskCartaoSus("800")).toBe("800");
      expect(maskCartaoSus("8000")).toBe("800.0");
      expect(maskCartaoSus("800000000000001")).toBe("800.0000.0000.0001");
    });

    it("trata colar texto já formatado ou com lixo", () => {
      expect(maskCartaoSus("800.0000.0000.0001")).toBe("800.0000.0000.0001");
      expect(maskCartaoSus("CNS: 800000000000001 (provisorio)")).toBe("800.0000.0000.0001");
    });

    it("limita a 15 dígitos", () => {
      expect(maskCartaoSus("80000000000000199999")).toBe("800.0000.0000.0001");
    });
  });

  describe("maskData (DD/MM/AAAA)", () => {
    it("formata digitação progressiva", () => {
      expect(maskData("28")).toBe("28");
      expect(maskData("281")).toBe("28/1");
      expect(maskData("28102026")).toBe("28/10/2026");
    });

    it("trata data colada em formato ISO do banco (AAAA-MM-DD)", () => {
      expect(maskData("2026-10-28")).toBe("28/10/2026");
    });

    it("limita a 8 dígitos", () => {
      expect(maskData("281020269999")).toBe("28/10/2026");
    });
  });

  describe("maskHora (HH:mm)", () => {
    it("formata horário", () => {
      expect(maskHora("0")).toBe("0");
      expect(maskHora("09")).toBe("09");
      expect(maskHora("093")).toBe("09:3");
      expect(maskHora("0930")).toBe("09:30");
    });

    it("limita a 4 dígitos", () => {
      expect(maskHora("093055")).toBe("09:30");
    });
  });

  describe("maskTelefone ((00) 90000-0000 ou (00) 0000-0000)", () => {
    it("formata telefone fixo de 10 dígitos", () => {
      expect(maskTelefone("8235221234")).toBe("(82) 3522-1234");
    });

    it("formata celular de 11 dígitos dinamicamente", () => {
      expect(maskTelefone("82998765432")).toBe("(82) 99876-5432");
    });

    it("trata colagem com caracteres especiais", () => {
      expect(maskTelefone("+55 82 99876-5432")).toBe("(55) 82998-7654");
    });
  });

  describe("aplicarMascara e preservação de cursor", () => {
    it("mantém cursor ao digitar no final", () => {
      const res = aplicarMascara(maskData, "281", 3);
      expect(res.valor).toBe("28/1");
      expect(res.cursor).toBe(4);
    });

    it("trata backspace sobre um separador '/'", () => {
      // Ao apagar a barra em '28/10/2026', deve apagar o dígito '8' anterior
      const anterior = "28/10/2026";
      const brutoAposApagarBarra = "2810/2026";
      const cursor = 2; // logo antes de 10
      const res = aplicarMascara(maskData, brutoAposApagarBarra, cursor, anterior);
      expect(res.valor).toBe("21/02/026");
    });
  });
});
