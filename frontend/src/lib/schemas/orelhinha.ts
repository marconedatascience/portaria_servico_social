/**
 * Contratos Zod do módulo Orelhinha (espelham os schemas Pydantic do backend).
 * Fluxo: input -> máscara (UI) -> safeParse (mensagens pt-BR) -> normalização -> API.
 * Valores normalizados: CNS/telefone só dígitos, data ISO AAAA-MM-DD, hora HH:mm.
 */
import { z } from "zod";
import { unmask } from "../masks/unmask";
import { brParaIso, horaValida, somarDias, hojeIso } from "../validators/calendario";
import { cnsValido, telefoneValido } from "../validators/documentos";

export const somarDiasCalendario = somarDias;
export const hojeEmMaceio = hojeIso;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

// ---------- Respostas da API (validadas antes de entrar no cache) ----------
export const regrasSchema = z.object({
  retroatividade_dias: z.number().int().min(0),
  janela_inicio: z.string().regex(HHMM),
  janela_fim: z.string().regex(HHMM),
  fuso: z.string(),
});
export type RegrasAgenda = z.infer<typeof regrasSchema>;

export const itemSchema = z.object({
  id: z.number().int(),
  nome_rn: z.string().nullable(),
  leito: z.string().nullable(),
  cartao_sus: z.string().nullable(),
  data_nascimento: z.string().regex(ISO).nullable(),
  sexo: z.enum(["F", "M"]).nullable(),
  nome_mae: z.string().nullable(),
  municipio: z.string().nullable(),
  telefone: z.string().nullable(),
  data_exame: z.string().regex(ISO),
  horario: z.string().regex(HHMM),
  status: z.string(),
  versao: z.number().int(),
  atualizado_em: z.string().nullable(),
});
export type OrelhinhaItem = z.infer<typeof itemSchema>;

export const agendaResponseSchema = z.object({
  itens: z.array(itemSchema),
  permissoes_campos: z.array(z.string()),
  regras: regrasSchema,
});
export type AgendaResponse = z.infer<typeof agendaResponseSchema>;

export const permissoesResponseSchema = z.object({
  perfil: z.string(),
  permissoes_campos: z.array(z.string()),
  regras: regrasSchema,
});
export type PermissoesResponse = z.infer<typeof permissoesResponseSchema>;

export const conflitoSchema = z.object({
  detail: z.object({ codigo: z.literal("conflito_versao"), atual: itemSchema }),
});

// ---------- Campos ----------
export const CAMPOS_AGENDA = ["data_exame", "horario"] as const;
export const CAMPOS_DEMOGRAFICOS = ["cartao_sus", "nome_mae", "municipio", "telefone"] as const;
export type CampoAgenda = (typeof CAMPOS_AGENDA)[number];
export type CampoDemografico = (typeof CAMPOS_DEMOGRAFICOS)[number];
export type DemograficoPayload = Partial<Record<CampoDemografico, string>>;
export type AgendaPayload = Partial<Record<CampoAgenda, string>>;

// ---------- Validação de formulário ----------
export type Resultado<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

function executar<T>(schema: z.ZodType<T>, entrada: string): Resultado<T> {
  const r = schema.safeParse(entrada);
  return r.success
    ? { ok: true, valor: r.data }
    : { ok: false, mensagem: r.error.issues[0]?.message ?? "Valor inválido." };
}

export interface ContextoAgenda {
  regras: RegrasAgenda;
  /** Hoje em America/Maceio (AAAA-MM-DD), injetado para facilitar teste. */
  hoje: string;
  dataNascimento: string | null;
  /** Subtrai dias de uma data ISO (aritmética de calendário). */
  somarDias: (iso: string, dias: number) => string;
}

export function validarDataExame(masked: string, ctx: ContextoAgenda): Resultado<string> {
  const minimo = ctx.somarDias(ctx.hoje, -ctx.regras.retroatividade_dias);
  const schema = z
    .string()
    .refine((v) => brParaIso(v) !== null, "Data inválida. Informe uma data real (DD/MM/AAAA).")
    .refine((v) => {
      const iso = brParaIso(v);
      return iso === null || ctx.dataNascimento === null || iso >= ctx.dataNascimento;
    }, "A data do exame não pode ser anterior ao nascimento.")
    .refine((v) => {
      const iso = brParaIso(v);
      return iso === null || iso >= minimo;
    }, "Data anterior ao limite permitido para remarcação.")
    .transform((v) => brParaIso(v) as string);
  return executar(schema, masked);
}

export function validarHoraExame(masked: string, regras: RegrasAgenda): Resultado<string> {
  const schema = z
    .string()
    .refine(horaValida, "Hora inválida. Use HH:mm entre 00:00 e 23:59.")
    .refine(
      (v) => !horaValida(v) || (v >= regras.janela_inicio && v <= regras.janela_fim),
      `Fora da janela de atendimento (${regras.janela_inicio}–${regras.janela_fim}).`,
    );
  return executar(schema, masked);
}

const textoNormalizado = (min: number, msg: string) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(min, msg).max(120, "Texto muito longo."));

const validadoresDemograficos: Record<CampoDemografico, z.ZodType<string, string>> = {
  cartao_sus: z
    .string()
    .refine(cnsValido, "Cartão SUS inválido. Confira os 15 dígitos.")
    .transform(unmask),
  nome_mae: textoNormalizado(3, "Informe o nome completo da mãe."),
  municipio: textoNormalizado(2, "Informe o município."),
  telefone: z
    .string()
    .refine(telefoneValido, "Telefone inválido. Use (00) 90000-0000 ou (00) 0000-0000.")
    .transform(unmask),
};

export function validarCampoDemografico(campo: CampoDemografico, valor: string): Resultado<string> {
  return executar(validadoresDemograficos[campo], valor);
}

export function validarDemografico(
  valores: Partial<Record<CampoDemografico, string>>,
): { ok: true; valor: DemograficoPayload } | { ok: false; erros: Partial<Record<CampoDemografico, string>> } {
  const valor: DemograficoPayload = {};
  const erros: Partial<Record<CampoDemografico, string>> = {};
  for (const campo of CAMPOS_DEMOGRAFICOS) {
    const entrada = valores[campo];
    if (entrada === undefined) continue;
    const r = validarCampoDemografico(campo, entrada);
    if (r.ok) valor[campo] = r.valor;
    else erros[campo] = r.mensagem;
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, valor };
}

/** Permissão vem SEMPRE da API (`permissoes_campos`); o front só reflete. */
export function podeEditar(permissoes: readonly string[], campo: string): boolean {
  return permissoes.includes(campo);
}
