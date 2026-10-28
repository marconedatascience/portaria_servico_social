/**
 * Hook para leitura de permissões e regras de negócio vindas do backend.
 * Nunca decide permissões no cliente de forma hardcoded: reflete permissoes_campos.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPermissoes } from "../lib/api/orelhinhaClient";
import { podeEditar } from "../lib/schemas/orelhinha";

export function useOrelhinhaPermissoes() {
  const query = useQuery({
    queryKey: ["orelhinha", "permissoes"],
    queryFn: fetchPermissoes,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache (invalidado via push se config_fluxos mudar)
    retry: 2,
  });

  const permissoesCampos = query.data?.permissoes_campos ?? [];
  const regras = query.data?.regras ?? {
    retroatividade_dias: 7,
    janela_inicio: "08:00",
    janela_fim: "17:00",
    fuso: "America/Maceio",
  };

  const checkPermissao = (campo: string) => podeEditar(permissoesCampos, campo);

  return {
    ...query,
    permissoesCampos,
    regras,
    perfil: query.data?.perfil ?? "desconhecido",
    podeEditar: checkPermissao,
  };
}
