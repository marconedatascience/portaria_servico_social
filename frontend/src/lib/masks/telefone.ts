import { unmask } from "./unmask";

/**
 * Máscara dinâmica:
 *  - até 10 dígitos  -> (00) 0000-0000  (fixo)
 *  - 11 dígitos      -> (00) 90000-0000 (celular)
 * O 11º dígito reagrupa o número automaticamente.
 */
export function maskTelefone(valor: string): string {
  const d = unmask(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${resto}`;
  const corte = d.length > 10 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
