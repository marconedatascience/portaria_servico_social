import { unmask } from "./unmask";

export type Mascara = (valor: string) => string;

export interface ResultadoMascara {
  valor: string;
  cursor: number;
}

/**
 * Aplica a máscara preservando a posição do cursor (conta dígitos à esquerda do cursor).
 *
 * `anterior` (valor antes da edição) permite tratar o backspace sobre um separador:
 * quando só um separador foi apagado, remove o dígito imediatamente anterior ao cursor
 * (comportamento esperado de "apagar para trás" em campos mascarados).
 */
export function aplicarMascara(
  mascara: Mascara,
  bruto: string,
  cursor: number,
  anterior?: string,
): ResultadoMascara {
  let texto = bruto;
  let pos = Math.min(Math.max(cursor, 0), texto.length);

  if (anterior !== undefined && texto.length < anterior.length && unmask(texto) === unmask(anterior)) {
    let i = pos - 1;
    while (i >= 0 && !/\d/.test(texto[i])) i--;
    if (i >= 0) {
      texto = texto.slice(0, i) + texto.slice(i + 1);
      pos = i;
    }
  }

  const digitosAntes = unmask(texto.slice(0, pos)).length;
  const valor = mascara(texto);

  let vistos = 0;
  let novo = 0;
  while (novo < valor.length && vistos < digitosAntes) {
    if (/\d/.test(valor[novo])) vistos++;
    novo++;
  }
  return { valor, cursor: novo };
}
