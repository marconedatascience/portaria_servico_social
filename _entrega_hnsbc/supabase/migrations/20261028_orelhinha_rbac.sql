-- =====================================================================
-- Orelhinha: colunas demográficas, lock otimista, config_fluxos (RBAC em dados),
-- auditoria, idempotência e RBAC no banco (3ª camada).
-- Estende public.slots_orelhinha (supabase_unificado_oficial_v2.sql).
-- Armazenamento SEM máscara: cartao_sus (15 díg.), telefone (só dígitos),
-- datas ISO (DATE), hora TIME (HH:mm).
-- =====================================================================

-- 1. Colunas novas ------------------------------------------------------
ALTER TABLE public.slots_orelhinha
    ADD COLUMN IF NOT EXISTS cartao_sus      CHAR(15),
    ADD COLUMN IF NOT EXISTS data_nascimento DATE,
    ADD COLUMN IF NOT EXISTS sexo            CHAR(1),
    ADD COLUMN IF NOT EXISTS municipio       VARCHAR(120),
    ADD COLUMN IF NOT EXISTS telefone        VARCHAR(11),
    ADD COLUMN IF NOT EXISTS versao          INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS atualizado_por  UUID;

ALTER TABLE public.slots_orelhinha
    DROP CONSTRAINT IF EXISTS ck_orelhinha_cartao_sus,
    DROP CONSTRAINT IF EXISTS ck_orelhinha_sexo,
    DROP CONSTRAINT IF EXISTS ck_orelhinha_telefone,
    DROP CONSTRAINT IF EXISTS ck_orelhinha_nascimento;

-- CNS: 15 dígitos iniciando em 1, 2, 7, 8 ou 9 (dígito verificador é validado na API)
-- Telefone: DDD 11-99; fixo = 8 dígitos; celular = 9 + 8 dígitos
ALTER TABLE public.slots_orelhinha
    ADD CONSTRAINT ck_orelhinha_cartao_sus CHECK (cartao_sus IS NULL OR cartao_sus ~ '^[12789][0-9]{14}$'),
    ADD CONSTRAINT ck_orelhinha_sexo       CHECK (sexo IS NULL OR sexo IN ('F', 'M')),
    ADD CONSTRAINT ck_orelhinha_telefone   CHECK (telefone IS NULL OR telefone ~ '^(1[1-9]|[2-9][0-9])([0-9]{8}|9[0-9]{8})$'),
    ADD CONSTRAINT ck_orelhinha_nascimento CHECK (data_nascimento IS NULL OR (data_nascimento >= DATE '1900-01-01' AND data_nascimento <= CURRENT_DATE + 1));

-- 2. config_fluxos: configuração em dados (nunca em código) --------------
CREATE TABLE IF NOT EXISTS public.config_fluxos (
    chave          TEXT PRIMARY KEY,
    valor          JSONB NOT NULL,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.config_fluxos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.config_fluxos FROM anon;

DROP POLICY IF EXISTS "config_fluxos_select" ON public.config_fluxos;
CREATE POLICY "config_fluxos_select" ON public.config_fluxos
    FOR SELECT TO authenticated USING (public.perfil_atual() IS NOT NULL);
-- Sem policy de escrita: somente migrations / service role alteram a matriz.

-- Matriz campo x perfil. Perfil ou campo ausente = NEGADO.
INSERT INTO public.config_fluxos (chave, valor) VALUES
('orelhinha.permissoes_campos', '{
    "fono":           ["data_exame", "horario"],
    "portaria":       ["cartao_sus", "nome_mae", "municipio", "telefone"],
    "servico_social": ["cartao_sus", "nome_mae", "municipio", "telefone"]
}'::jsonb),
('orelhinha.perfis_leitura', '["fono", "portaria", "servico_social", "admin"]'::jsonb),
('orelhinha.regras_agenda', '{
    "retroatividade_dias": 1,
    "janela_inicio": "07:00",
    "janela_fim": "18:00",
    "fuso": "America/Maceio"
}'::jsonb)
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();

-- Invalidação do cache Redis: o backend faz LISTEN neste canal.
CREATE OR REPLACE FUNCTION public.trg_config_fluxos_notify() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em := now();
    PERFORM pg_notify('config_fluxos_changed', NEW.chave);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_config_fluxos_notify ON public.config_fluxos;
CREATE TRIGGER trg_config_fluxos_notify
    BEFORE INSERT OR UPDATE ON public.config_fluxos
    FOR EACH ROW EXECUTE FUNCTION public.trg_config_fluxos_notify();

-- 3. Auditoria por campo ---------------------------------------------------
-- Contém PII por necessidade de auditoria; acesso restrito a admin (RLS).
CREATE TABLE IF NOT EXISTS public.auditoria_orelhinha (
    id              BIGSERIAL PRIMARY KEY,
    slot_id         BIGINT NOT NULL REFERENCES public.slots_orelhinha(id) ON DELETE CASCADE,
    campo           TEXT NOT NULL,
    valor_anterior  TEXT,
    valor_novo      TEXT,
    usuario_id      UUID,
    perfil          TEXT NOT NULL,
    operation_id    UUID,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_orelhinha_slot ON public.auditoria_orelhinha (slot_id, criado_em DESC);
ALTER TABLE public.auditoria_orelhinha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_orelhinha FROM anon;

DROP POLICY IF EXISTS "auditoria_orelhinha_select_admin" ON public.auditoria_orelhinha;
CREATE POLICY "auditoria_orelhinha_select_admin" ON public.auditoria_orelhinha
    FOR SELECT TO authenticated USING (public.perfil_atual() = 'admin');

-- 4. Idempotência por operation_id (UUID gerado no cliente) ---------------
CREATE TABLE IF NOT EXISTS public.orelhinha_operacoes (
    operation_id  UUID PRIMARY KEY,
    slot_id       BIGINT NOT NULL,
    versao        INTEGER NOT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orelhinha_operacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orelhinha_operacoes FROM anon, authenticated;

-- 5. RBAC no banco: guard BEFORE UPDATE -----------------------------------
-- Compara OLD x NEW coluna a coluna. Coluna alterada que não esteja na matriz
-- do perfil => 42501. Falta de config_fluxos => nega (fallback seguro).
-- Também controla versao (lock otimista) e grava auditoria.
-- O backend FastAPI define request.jwt.claims e app.operation_id na transação,
-- então o mesmo guard vale para acessos via API e via PostgREST.
CREATE OR REPLACE FUNCTION public.trg_orelhinha_guard() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_perfil     text := public.perfil_atual();
    v_permitidos jsonb;
    v_op         uuid := nullif(current_setting('app.operation_id', true), '')::uuid;
    v_uid        uuid := nullif(auth.jwt() ->> 'sub', '')::uuid;
    v_chave      text;
    v_novo       jsonb := to_jsonb(NEW);
    v_velho      jsonb := to_jsonb(OLD);
    v_ignorar    text[] := ARRAY['versao', 'atualizado_em', 'atualizado_por'];
BEGIN
    IF v_perfil IS NULL THEN
        RAISE EXCEPTION 'RBAC: perfil ausente' USING ERRCODE = '42501';
    END IF;

    SELECT valor -> v_perfil INTO v_permitidos
      FROM config_fluxos WHERE chave = 'orelhinha.permissoes_campos';

    IF v_permitidos IS NULL THEN
        v_permitidos := '[]'::jsonb;  -- config indisponível ou perfil não listado => nega
    END IF;

    FOR v_chave IN SELECT jsonb_object_keys(v_novo) LOOP
        CONTINUE WHEN v_chave = ANY (v_ignorar);
        IF (v_novo -> v_chave) IS DISTINCT FROM (v_velho -> v_chave) THEN
            IF NOT (v_permitidos ? v_chave) THEN
                RAISE EXCEPTION 'RBAC: perfil % não pode alterar %', v_perfil, v_chave
                    USING ERRCODE = '42501';
            END IF;
            INSERT INTO auditoria_orelhinha
                (slot_id, campo, valor_anterior, valor_novo, usuario_id, perfil, operation_id)
            VALUES
                (OLD.id, v_chave, v_velho ->> v_chave, v_novo ->> v_chave, v_uid, v_perfil, v_op);
        END IF;
    END LOOP;

    -- versao é sempre controlada pelo banco; o cliente não escolhe
    NEW.versao         := OLD.versao + 1;
    NEW.atualizado_em  := now();
    NEW.atualizado_por := v_uid;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orelhinha_guard ON public.slots_orelhinha;
CREATE TRIGGER trg_orelhinha_guard
    BEFORE UPDATE ON public.slots_orelhinha
    FOR EACH ROW EXECUTE FUNCTION public.trg_orelhinha_guard();

-- 6. RLS: update apenas para perfis operacionais ---------------------------
-- (o guard restringe QUAIS colunas; a policy restringe QUEM pode tentar)
DROP POLICY IF EXISTS "slots_update_setor" ON public.slots_orelhinha;
CREATE POLICY "slots_update_setor" ON public.slots_orelhinha
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

-- 7. Realtime (mecanismo já existente no projeto: Supabase Realtime) -------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND tablename = 'slots_orelhinha'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.slots_orelhinha;
    END IF;
END $$;
