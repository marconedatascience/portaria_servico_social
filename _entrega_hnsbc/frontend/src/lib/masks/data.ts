import { unmask } from "./unmask";

const ISO_COMPLETA = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/;

/**
 * DD/MM/AAAA. Se o texto for exatamente uma data ISO (AAAA-MM-DD, ex.: colada do banco),
 * converte; caso contrário usa só os dígitos digitados.
 * Não usa `Date`: data é valor de calendário (evita deslocamento de fuso).
 */
export function maskData(valor: string): string {
  const iso = ISO_COMPLETA.exec(valor);
  const d = iso ? `${iso[3]}${iso[2]}${iso[1]}` : unmask(valor).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}
