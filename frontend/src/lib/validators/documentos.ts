import { unmask } from "../masks/unmask";

const INICIAIS_VALIDAS = ["1", "2", "7", "8", "9"];

/** CNS: 15 dígitos, iniciais 1/2/7/8/9 e dígito verificador (mesmo algoritmo do backend). */
export function cnsValido(valor: string): boolean {
  const cns = unmask(valor);
  if (cns.length !== 15 || !INICIAIS_VALIDAS.includes(cns[0])) return false;
  const ponderar = (digitos: string) =>
    [...digitos].reduce((acc, d, i) => acc + Number(d) * (15 - i), 0);

  if (cns[0] === "1" || cns[0] === "2") {
    const pis = cns.slice(0, 11);
    let soma = ponderar(pis);
    const resto = soma % 11;
    let dv = resto === 0 ? 0 : 11 - resto;
    if (dv === 10) {
      soma += 2;
      dv = 11 - (soma % 11);
      return cns === `${pis}001${dv}`;
    }
    return cns === `${pis}000${dv}`;
  }
  return ponderar(cns) % 11 === 0;
}

/** Telefone (dígitos): fixo DDD+8 ou celular DDD+9 iniciando em 9; DDD 11-99. */
export function telefoneValido(valor: string): boolean {
  const t = unmask(valor);
  if (t.length !== 10 && t.length !== 11) return false;
  const ddd = Number(t.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return t.length === 10 || t[2] === "9";
}
