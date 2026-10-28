/**
 * Cálculo de diff de campos demográficos para payload mínimo no PATCH.
 * Apenas os campos efetivamente alterados são enviados ao backend.
 */
import { CAMPOS_DEMOGRAFICOS, CampoDemografico, DemograficoPayload, OrelhinhaItem } from "../schemas/orelhinha";

export function calcularDiffDemografico(
  original: OrelhinhaItem,
  novosValoresNormalizados: DemograficoPayload,
): DemograficoPayload {
  const diff: DemograficoPayload = {};

  for (const campo of CAMPOS_DEMOGRAFICOS) {
    if (campo in novosValoresNormalizados) {
      const novo = novosValoresNormalizados[campo];
      const antigo = original[campo] ?? undefined;

      // Normaliza comparação (null/undefined e strings vazias)
      const normNovo = novo === undefined || novo === "" ? null : novo;
      const normAntigo = antigo === undefined || antigo === "" ? null : antigo;

      if (normNovo !== normAntigo) {
        diff[campo] = normNovo ?? "";
      }
    }
  }

  return diff;
}
