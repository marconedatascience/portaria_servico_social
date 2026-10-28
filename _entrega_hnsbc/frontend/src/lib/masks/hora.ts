import { unmask } from "./unmask";

/** HH:mm. Aceita "0930", "09:30", "9h30 hrs" etc. (somente dígitos são considerados). */
export function maskHora(valor: string): string {
  const d = unmask(valor).slice(0, 4);
  return [d.slice(0, 2), d.slice(2, 4)].filter(Boolean).join(":");
}
