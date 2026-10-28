export { unmask } from "./unmask";
export { maskCartaoSus } from "./cartaoSus";
export { maskData } from "./data";
export { maskHora } from "./hora";
export { maskTelefone } from "./telefone";
export { aplicarMascara } from "./cursor";
export type { Mascara, ResultadoMascara } from "./cursor";

/** Exibição parcial (LGPD): na tabela só os 4 últimos dígitos. O valor completo aparece apenas no sheet de edição. */
export function ocultarCartaoSus(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  return d ? `•••.••••.••••.${d.slice(-4).padStart(4, "•")}` : "—";
}

export function ocultarTelefone(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  return d ? `(••) •••••-${d.slice(-4).padStart(4, "•")}` : "—";
}
