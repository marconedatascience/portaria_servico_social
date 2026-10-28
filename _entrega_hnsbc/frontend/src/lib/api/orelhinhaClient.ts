/**
 * Cliente HTTP tipado para o módulo Teste da Orelhinha.
 * Valida todas as respostas da API com schemas Zod antes de propagar.
 * Trata If-Match, 409 Conflito de Versão, 403 Permissão Negada e 428 Precondição.
 */
import {
  agendaResponseSchema,
  permissoesResponseSchema,
  itemSchema,
  conflitoSchema,
  type AgendaResponse,
  type PermissoesResponse,
  type OrelhinhaItem,
  type AgendaPayload,
  type DemograficoPayload,
} from "../schemas/orelhinha";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/v1/orelhinha`
  : "/api/v1/orelhinha";

export class ErroConflitoVersao extends Error {
  public readonly atual: OrelhinhaItem;
  constructor(atual: OrelhinhaItem) {
    super("O registro foi modificado por outro usuário enquanto você editava.");
    this.name = "ErroConflitoVersao";
    this.atual = atual;
  }
}

export class ErroPermissaoNegada extends Error {
  constructor(msg = "Você não tem permissão para alterar este campo.") {
    super(msg);
    this.name = "ErroPermissaoNegada";
  }
}

export class ErroHttpOrelhinha extends Error {
  public readonly status: number;
  public readonly data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ErroHttpOrelhinha";
    this.status = status;
    this.data = data;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 403) {
    throw new ErroPermissaoNegada();
  }

  if (res.status === 409) {
    const raw = await res.json().catch(() => null);
    const parsed = conflitoSchema.safeParse(raw);
    if (parsed.success) {
      throw new ErroConflitoVersao(parsed.data.detail.atual);
    }
    throw new ErroHttpOrelhinha(409, "Conflito de versão ao salvar o registro.", raw);
  }

  if (!res.ok) {
    const raw = await res.json().catch(() => null);
    throw new ErroHttpOrelhinha(res.status, `Falha na requisição (${res.status})`, raw);
  }

  const json = await res.json();
  return { data: json, headers: res.headers };
}

export async function fetchPermissoes(): Promise<PermissoesResponse> {
  const { data } = await fetchJson<unknown>(`${API_BASE}/permissoes`);
  const parsed = permissoesResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Contrato de permissões inválido: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function fetchAgenda(): Promise<AgendaResponse> {
  const { data } = await fetchJson<unknown>(`${API_BASE}/agenda`);
  const parsed = agendaResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Contrato de agenda inválido: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function patchAgenda(
  slotId: number,
  versao: number,
  payload: AgendaPayload,
): Promise<{ item: OrelhinhaItem; etag: string | null }> {
  const { data, headers } = await fetchJson<unknown>(`${API_BASE}/agenda/${slotId}`, {
    method: "PATCH",
    headers: {
      "If-Match": `"${versao}"`,
    },
    body: JSON.stringify(payload),
  });

  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Item retornado com contrato inválido: ${parsed.error.message}`);
  }
  return { item: parsed.data, etag: headers.get("ETag") };
}

export async function patchDemografico(
  slotId: number,
  versao: number,
  payload: DemograficoPayload,
  operationId?: string,
): Promise<{ item: OrelhinhaItem; reaplicada: boolean }> {
  const headersInit: Record<string, string> = {
    "If-Match": `"${versao}"`,
  };

  const bodyData = {
    ...payload,
    ...(operationId ? { operation_id: operationId } : {}),
  };

  const { data, headers } = await fetchJson<unknown>(`${API_BASE}/agenda/${slotId}/demografico`, {
    method: "PATCH",
    headers: headersInit,
    body: JSON.stringify(bodyData),
  });

  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Item retornado com contrato inválido: ${parsed.error.message}`);
  }

  const reaplicada = headers.get("Idempotent-Replay") === "true";
  return { item: parsed.data, reaplicada };
}
