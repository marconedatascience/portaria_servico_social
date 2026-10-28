import { unmask } from "./unmask";

/** 000.0000.0000.0000 (15 dígitos). Aceita digitação, colagem formatada ou com lixo. */
export function maskCartaoSus(valor: string): string {
  const d = unmask(valor).slice(0, 15);
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11), d.slice(11, 15)].filter(Boolean).join(".");
}
