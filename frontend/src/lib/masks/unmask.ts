/** Remove tudo que não for dígito. Base de todas as máscaras (funções puras, sem dependências). */
export function unmask(valor: string): string {
  return valor.replace(/\D/g, "");
}
