import type { Session } from '@supabase/supabase-js';

// Setores do sistema. O setor é gravado pela administração em app_metadata.role
// (somente a service role consegue alterar app_metadata; o usuário não).
export type Perfil = 'portaria' | 'servico_social' | 'fono';

const PERFIS: readonly Perfil[] = ['portaria', 'servico_social', 'fono'];

/**
 * Lê o setor aprovado da sessão. Retorna null se a conta ainda não foi aprovada.
 * Obs.: isto controla apenas a TELA. A proteção real dos dados é o RLS do Supabase,
 * que lê o mesmo campo do token assinado (supabase_seguranca_rls.sql).
 */
export function perfilDaSessao(session: Session | null): Perfil | null {
  const meta = (session?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const bruto = meta.role ?? meta.setor;
  const perfil = typeof bruto === 'string' ? bruto.trim().toLowerCase() : '';
  return (PERFIS as readonly string[]).includes(perfil) ? (perfil as Perfil) : null;
}

/** Página inicial de cada setor após o login. */
export function rotaInicialDoPerfil(perfil: Perfil): string {
  return perfil === 'fono' ? '/dashboard/fono' : '/';
}
