-- =====================================================================
-- CRM Portaria HNSBC - Segurança (Row Level Security)
-- Execute no Supabase: SQL Editor -> New query -> colar -> Run
-- Objetivo: somente funcionários AUTENTICADOS E COM SETOR APROVADO acessam
-- dados de pacientes. Contas recém-cadastradas (sem setor) não leem nada.
-- Visitantes anônimos (apenas com a chave pública) não leem nem alteram nada.
--
-- O setor fica em auth.users.raw_app_meta_data ->> 'role' (app_metadata).
-- O usuário NÃO consegue alterar app_metadata; só a administração (SQL Editor
-- ou service role). Nunca use user_metadata para permissões: o próprio
-- usuário pode alterá-lo pelo navegador.
-- =====================================================================

-- 0) Setor do usuário logado, lido do token assinado (JWT)
CREATE OR REPLACE FUNCTION public.perfil_atual()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT lower(coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'setor'
    ));
$$;

-- 1) Ativar RLS nas tabelas
ALTER TABLE public.pacientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_horarios ENABLE ROW LEVEL SECURITY;

-- 2) Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "pacientes_select_autenticado" ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_update_autenticado" ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_insert_autenticado" ON public.pacientes;
DROP POLICY IF EXISTS "regras_select_autenticado"    ON public.regras_horarios;
DROP POLICY IF EXISTS "pacientes_select_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_update_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_insert_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "regras_select_setor"          ON public.regras_horarios;

-- 3) Pacientes: somente Portaria e Serviço Social
CREATE POLICY "pacientes_select_setor" ON public.pacientes
  FOR SELECT TO authenticated
  USING (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "pacientes_insert_setor" ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "pacientes_update_setor" ON public.pacientes
  FOR UPDATE TO authenticated
  USING      (public.perfil_atual() IN ('portaria', 'servico_social'))
  WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- (Sem política de DELETE: ninguém apaga pacientes pelo aplicativo.)

-- 4) Regras de horários: somente leitura para qualquer setor aprovado
CREATE POLICY "regras_select_setor" ON public.regras_horarios
  FOR SELECT TO authenticated
  USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

-- 5) Revogar acesso do papel anônimo
REVOKE ALL ON public.pacientes       FROM anon;
REVOKE ALL ON public.regras_horarios FROM anon;

-- 6) Aprovação de contas (uso exclusivo da administração no SQL Editor)
CREATE OR REPLACE FUNCTION public.aprovar_usuario(p_email text, p_setor text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF lower(p_setor) NOT IN ('portaria', 'servico_social', 'fono') THEN
        RAISE EXCEPTION 'Setor inválido: %. Use portaria, servico_social ou fono.', p_setor;
    END IF;

    UPDATE auth.users
       SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                               || jsonb_build_object('role', lower(p_setor))
     WHERE email = lower(trim(p_email));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado: %', p_email;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revogar_usuario(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    UPDATE auth.users
       SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role' - 'setor'
     WHERE email = lower(trim(p_email));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado: %', p_email;
    END IF;
END;
$$;

-- Ninguém do aplicativo pode chamar estas funções (só o SQL Editor / service role).
REVOKE ALL ON FUNCTION public.aprovar_usuario(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revogar_usuario(text)       FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- COMO APROVAR (rodar no SQL Editor, uma linha por pessoa):
--
--   -- Contas aguardando aprovação:
--   SELECT email, created_at FROM auth.users
--    WHERE coalesce(raw_app_meta_data ->> 'role', '') = '' ORDER BY created_at DESC;
--
--   SELECT public.aprovar_usuario('fulano@hnsbc.org.br', 'portaria');
--   SELECT public.aprovar_usuario('ciclana@hnsbc.org.br', 'servico_social');
--   SELECT public.aprovar_usuario('beltrana@hnsbc.org.br', 'fono');
--
--   -- Desligamento / remover acesso:
--   SELECT public.revogar_usuario('fulano@hnsbc.org.br');
--
-- Antes de aprovar, confirme que a pessoa é mesmo funcionária: o cadastro
-- não envia e-mail de confirmação.
-- Depois de aprovar, a pessoa clica em "verificar novamente" (ou sai e entra).
-- Ao revogar, o token antigo ainda vale por até 1 hora (validade padrão do JWT).
-- ---------------------------------------------------------------------
