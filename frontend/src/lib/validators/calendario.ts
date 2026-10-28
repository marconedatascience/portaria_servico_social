/**
 * Data como VALOR DE CALENDÁRIO (string "AAAA-MM-DD"). Nunca usar `new Date("AAAA-MM-DD")`:
 * ele é interpretado em UTC e desloca o dia em UTC-3 (America/Maceio).
 */
import { unmask } from "../masks/unmask";

export const FUSO = "America/Maceio";
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

/** true se a string é uma data ISO real de calendário (31/02 e 29/02 em ano comum são inválidos). */
export function isoValido(iso: string): boolean {
  const m = ISO.exec(iso);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(ano, mes);
}

/** "28/10/2026" -> "2026-10-28"; null se incompleta ou inexistente no calendário. */
export function brParaIso(br: string): string | null {
  const d = unmask(br);
  if (d.length !== 8) return null;
  const iso = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  return isoValido(iso) ? iso : null;
}

/** "2026-10-28" -> "28/10/2026" (apenas rearranjo de texto). */
export function isoParaBr(iso: string): string {
  const m = ISO.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Data de hoje (calendário) em America/Maceio, independente do fuso do tablet. */
export function hojeIso(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Soma dias a uma data ISO por aritmética de calendário (UTC apenas como calculadora). */
export function somarDias(iso: string, dias: number): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function horaValida(hhmm: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm);
}
