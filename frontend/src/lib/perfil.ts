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
  switch (perfil) {
    case 'portaria':
      return '/dashboard/portaria';
    case 'fono':
      return '/dashboard/fono';
    case 'servico_social':
      return '/'; // Painel Geral com foco em Serviço Social & Visitas
    case 'admin':
      return '/';
    default:
      return '/';
  }
}

/**
 * Retorna o perfil ativo do usuário atual para controle de acesso (RBAC).
 * Suporta passagem explícita de session ou inferência client-side (cache/URL).
 */
export function perfil_atual(session?: Session | null): Perfil {
  if (session) {
    const p = perfilDaSessao(session);
    if (p) return p;
  }

  if (typeof window !== 'undefined') {
    // 1. Tenta recuperar do storage local da sessão
    const salvo = localStorage.getItem('perfil_usuario_atual');
    if (salvo && ['portaria', 'servico_social', 'fono', 'admin'].includes(salvo)) {
      return salvo as Perfil;
    }

    // 2. Tenta inferir da rota do Next.js
    const path = window.location.pathname;
    if (path.includes('/dashboard/fono')) return 'fono';
    if (path.includes('/dashboard/portaria')) return 'portaria';
  }

  // Padrão seguro para o painel geral (Serviço Social)
  return 'servico_social';
}

/**
 * RBAC: Fonoaudiólogo(a) e Admin são os ÚNICOS com permissão de UPDATE em Data do Exame e Hora.
 * Portaria e Serviço Social têm permissão estritamente READ-ONLY nesses campos.
 */
export function canEditDataHora(perfil: Perfil | string | null): boolean {
  if (!perfil) return false;
  return perfil === 'fono' || perfil === 'admin';
}

/**
 * RBAC: Portaria, Serviço Social, Fonoaudiólogo e Admin podem atualizar dados demográficos
 * (Cartão SUS, Nome da Mãe, Município, Telefone, Sexo, Data de Nasc.).
 */
export function canEditDemograficos(perfil: Perfil | string | null): boolean {
  if (!perfil) return false;
  return ['portaria', 'servico_social', 'fono', 'admin'].includes(perfil);
}

/**
 * RBAC: Portaria e Serviço Social possuem autorização para realizar Check-in de chegada da mãe/bebê.
 */
export function canCheckin(perfil: Perfil | string | null): boolean {
  if (!perfil) return false;
  return ['portaria', 'servico_social', 'admin'].includes(perfil);
}

