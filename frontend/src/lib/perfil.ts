import type { Session } from '@supabase/supabase-js';

// Setores do sistema. O setor é gravado pela administração em app_metadata.role ou app_metadata.setor
export type Perfil = 'portaria' | 'servico_social' | 'fono' | 'admin';

/**
 * Lê o setor ou permissão aprovada da sessão. Retorna null se a conta ainda não foi aprovada.
 */
export function perfilDaSessao(session: Session | null): Perfil | null {
  const meta = (session?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;

  // 1. Verifica role de admin (acesso total administrativo)
  const roleBruto = meta.role ?? userMeta.role;
  if (typeof roleBruto === 'string') {
    const r = roleBruto.trim().toLowerCase();
    if (r === 'admin') return 'admin';
    if (['portaria', 'servico_social', 'fono'].includes(r)) {
      return r as Perfil;
    }
  }

  // 2. Verifica setor específico
  const setorBruto = meta.setor ?? userMeta.setor;
  if (typeof setorBruto === 'string') {
    const s = setorBruto.trim().toLowerCase();
    if (['portaria', 'servico_social', 'fono'].includes(s)) {
      return s as Perfil;
    }
  }

  return null;
}

/** Página inicial de cada setor após o login. */
export function rotaInicialDoPerfil(perfil: Perfil): string {
  return perfil === 'fono' ? '/dashboard/fono' : '/';
}
