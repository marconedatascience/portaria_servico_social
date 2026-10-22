-- =====================================================================
-- CRM PORTARIA HNSBC - SCRIPT SQL COMPLETO E OFICIAL (SUPABASE)
-- Baseado nas diretrizes estritas de .agents/regras_portaria.md
--
-- Local de Execução: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- URL: https://supabase.com/dashboard/project/mlzclvxlqiepvxzsxxgn/sql/new
--
-- REGRAS E SEGURANÇA CRÍTICA IMPLEMENTADAS:
-- 1. ROW-LEVEL SECURITY (RLS) ATIVADO EM TODAS AS TABELAS (pessoas, internacoes, credenciais, etc.):
--    - Acesso anônimo (anon) completamente revogado para evitar vazamento de dados públicos.
--    - Políticas estritas baseadas em JWT (perfil_atual() IN ('portaria', 'servico_social', 'fono')).
-- 2. Cota Visitantes/Dia (Anti-revezamento):
--    - Normais (15h-16h): max 2/paciente/dia.
--    - Vermelha (16h-17h): max 1/paciente/dia.
--    - Bloqueio com erro exato: "Cota máxima atingida hoje".
--    - QR Code com payload cego: "HNSBC|TokenUUID" (zero dados sensíveis expostos).
-- 3. Acompanhantes:
--    - Max 1 ativo simultaneamente.
--    - Trocas apenas: 07:30-08:30 / 18:30-19:30 (fuso SP).
--    - Fluxo RPC atômico: Revoga credencial anterior + cadastra nova.
-- 4. Orelhinha (Fono & Portaria):
--    - Fonoaudiologia cria slots.
--    - Serviço Social vincula RN (fallback automático "RN de [Nome Mãe]" se s/ CPF).
--    - Portaria: Liberação requer marcar checkboxes [x] Caderneta [x] Registro.
-- 5. Alta Hospitalar:
--    - Confirmação da Portaria -> altera status internação='ALTA' -> libera leito -> revoga credenciais ativas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSÕES DO POSTGRESQL
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. FUNÇÃO AUXILIAR: perfil_atual()
-- Lê a role ou setor do usuário autenticado a partir dos claims do JWT
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. GESTÃO DE ACESSO (aprovar_usuario e revogar_usuario)
-- ---------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.aprovar_usuario(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revogar_usuario(text)       FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 4. TABELAS PRINCIPAIS (COM RLS ATIVADO IMEDIATAMENTE EM TODAS)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1. TABELA DE PESSOAS (Pacientes, Acompanhantes, Visitantes, Recém-Nascidos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pessoas (
    id            BIGSERIAL PRIMARY KEY,
    nome          VARCHAR(255) NOT NULL,
    cpf           VARCHAR(14),
    rg            VARCHAR(20),
    telefone      VARCHAR(20),
    nome_mae      VARCHAR(255),
    municipio     VARCHAR(150),
    tipo_pessoa   VARCHAR(50) DEFAULT 'PACIENTE', -- 'PACIENTE', 'ACOMPANHANTE', 'VISITANTE', 'RN'
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS CRÍTICO: Ativação e revogação para anon
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pessoas FROM anon;

CREATE INDEX IF NOT EXISTS idx_pessoas_nome     ON public.pessoas (nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_cpf      ON public.pessoas (cpf);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome_mae ON public.pessoas (nome_mae);

-- ---------------------------------------------------------------------
-- 4.2. TABELA DE INTERNAÇÕES (O Prontuário Ativo do Leito)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internacoes (
    id                    BIGSERIAL PRIMARY KEY,
    id_atendimento        VARCHAR(50) UNIQUE NOT NULL,
    paciente_id           BIGINT NOT NULL REFERENCES public.pessoas(id) ON DELETE RESTRICT,
    leito                 VARCHAR(50) NOT NULL,
    setor_clinica         VARCHAR(100) NOT NULL DEFAULT 'Clínica Médica', -- 'Clínica Médica', 'Vermelha', 'Clínica Cirúrgica', 'Maternidade', 'Pediatria'
    status_internacao     VARCHAR(50) NOT NULL DEFAULT 'INTERNADO',       -- 'INTERNADO', 'ALTA'
    data_internacao       TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_alta             TIMESTAMPTZ,
    leito_anterior        VARCHAR(50),
    acompanhante_atual_id BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    visitante_atual_id    BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS CRÍTICO: Ativação e revogação para anon
ALTER TABLE public.internacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internacoes FROM anon;

CREATE INDEX IF NOT EXISTS idx_internacoes_atendimento ON public.internacoes (id_atendimento);
CREATE INDEX IF NOT EXISTS idx_internacoes_leito       ON public.internacoes (leito);
CREATE INDEX IF NOT EXISTS idx_internacoes_status      ON public.internacoes (status_internacao);
CREATE INDEX IF NOT EXISTS idx_internacoes_paciente    ON public.internacoes (paciente_id);

-- ---------------------------------------------------------------------
-- 4.3. TABELA DE CREDENCIAIS (Controle de Acesso & QR Code Cego Anti-revezamento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credenciais (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internacao_id BIGINT NOT NULL REFERENCES public.internacoes(id) ON DELETE CASCADE,
    pessoa_id     BIGINT REFERENCES public.pessoas(id) ON DELETE SET NULL,
    tipo          VARCHAR(50) NOT NULL, -- 'VISITANTE', 'ACOMPANHANTE', 'ORELHINHA', 'OBITO'
    nome_pessoa   VARCHAR(255) NOT NULL,
    documento     VARCHAR(50),
    telefone      VARCHAR(50),
    token_qr      UUID NOT NULL DEFAULT gen_random_uuid(),
    status        VARCHAR(50) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'UTILIZADO', 'REVOGADO', 'CANCELADO'
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    entrada_em    TIMESTAMPTZ,
    saida_em      TIMESTAMPTZ,
    criado_por    UUID DEFAULT auth.uid()
);

-- RLS CRÍTICO: Ativação e revogação para anon
ALTER TABLE public.credenciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credenciais FROM anon;

CREATE INDEX IF NOT EXISTS idx_credenciais_internacao_tipo ON public.credenciais (internacao_id, tipo, criado_em);
CREATE INDEX IF NOT EXISTS idx_credenciais_token_qr         ON public.credenciais (token_qr);
CREATE INDEX IF NOT EXISTS idx_credenciais_status           ON public.credenciais (status);

-- ---------------------------------------------------------------------
-- 4.4. TABELA DE REGRAS DE HORÁRIOS (Janelas Oficiais)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regras_horarios (
    id             BIGSERIAL PRIMARY KEY,
    tipo_regra     VARCHAR(100) NOT NULL,
    descricao      TEXT,
    horario_inicio TIME,
    horario_fim    TIME,
    cota_maxima    INTEGER DEFAULT NULL,
    setor_aplicavel VARCHAR(100) DEFAULT 'Todos',
    ativo          BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.regras_horarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regras_horarios FROM anon;

-- Carregar janelas estritas de acordo com o regras_portaria.md
DELETE FROM public.regras_horarios WHERE tipo_regra IN ('Visita Normal', 'Visita Vermelha', 'Troca de Acompanhante');

INSERT INTO public.regras_horarios (tipo_regra, descricao, horario_inicio, horario_fim, cota_maxima, setor_aplicavel, ativo)
VALUES
    ('Visita Normal', 'Visita Enfermarias e Clínicas (Máx 2/dia)', '15:00:00'::time, '16:00:00'::time, 2, 'Geral', TRUE),
    ('Visita Vermelha', 'Visita Área Vermelha (Máx 1/dia)', '16:00:00'::time, '17:00:00'::time, 1, 'Vermelha', TRUE),
    ('Troca de Acompanhante', 'Janela da Manhã para Troca de Acompanhante', '07:30:00'::time, '08:30:00'::time, 1, 'Todos', TRUE),
    ('Troca de Acompanhante', 'Janela da Noite para Troca de Acompanhante', '18:30:00'::time, '19:30:00'::time, 1, 'Todos', TRUE);

-- ---------------------------------------------------------------------
-- 4.5. TABELA DE SLOTS DO TESTE DA ORELHINHA
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slots_orelhinha (
    id                  BIGSERIAL PRIMARY KEY,
    data_exame          DATE NOT NULL,
    horario             TIME NOT NULL,
    turno               VARCHAR(20) DEFAULT 'MANHA',
    internacao_id       BIGINT REFERENCES public.internacoes(id) ON DELETE SET NULL,
    nome_rn             VARCHAR(255),
    nome_mae            VARCHAR(255),
    leito               VARCHAR(50),
    caderneta_vacinacao BOOLEAN NOT NULL DEFAULT FALSE,
    registro_nascimento BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(50) NOT NULL DEFAULT 'DISPONIVEL', -- 'DISPONIVEL', 'AGENDADO', 'LIBERADO_PORTARIA', 'REALIZADO', 'CANCELADO'
    observacoes         TEXT,
    credencial_id       UUID REFERENCES public.credenciais(id) ON DELETE SET NULL,
    criado_por          UUID DEFAULT auth.uid(),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    liberado_por        UUID,
    liberado_em         TIMESTAMPTZ
);

ALTER TABLE public.slots_orelhinha ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slots_orelhinha FROM anon;

CREATE INDEX IF NOT EXISTS idx_slots_orelhinha_data ON public.slots_orelhinha (data_exame, horario);

-- ---------------------------------------------------------------------
-- 4.6. TABELA DE ALTAS HOSPITALARES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.altas (
    id             BIGSERIAL PRIMARY KEY,
    internacao_id  BIGINT NOT NULL REFERENCES public.internacoes(id) ON DELETE CASCADE,
    leito_liberado VARCHAR(50),
    confirmado_por UUID DEFAULT auth.uid(),
    observacoes    TEXT,
    data_hora      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.altas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.altas FROM anon;

CREATE INDEX IF NOT EXISTS idx_altas_internacao ON public.altas (internacao_id, data_hora DESC);

-- ---------------------------------------------------------------------
-- 4.7. AUDITORIA DA PORTARIA
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_portaria (
    id            BIGSERIAL PRIMARY KEY,
    internacao_id BIGINT REFERENCES public.internacoes(id) ON DELETE SET NULL,
    acao          VARCHAR(100) NOT NULL,
    detalhes      JSONB,
    usuario_id    UUID DEFAULT auth.uid(),
    usuario_email TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_portaria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_portaria FROM anon;

-- =====================================================================
-- 5. VIEW DE COMPATIBILIDADE `pacientes` (com placar real do dia)
-- security_invoker = true: a view aplica o RLS de QUEM CONSULTA.
-- Sem isso, a view roda como o dono (postgres) e ignora o RLS das tabelas.
-- =====================================================================
-- =====================================================================
-- 5. VIEW DE COMPATIBILIDADE pacientes (com placar real do dia)
-- security_invoker = true: a view aplica o RLS de QUEM CONSULTA.
-- Sem isso, a view roda como o dono (postgres) e ignora o RLS das tabelas.
-- =====================================================================
-- Limpeza de estruturas legadas para evitar erro 'pacientes is not a view / already exists'
DROP VIEW IF EXISTS public.vw_pacientes_internados CASCADE;
DROP VIEW IF EXISTS public.vw_agenda_fono CASCADE;
DROP VIEW IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.agendamentos CASCADE;
DROP TABLE IF EXISTS public.acompanhantes_ativos CASCADE;
DROP TABLE IF EXISTS public.logs_acesso CASCADE;

CREATE VIEW public.pacientes
WITH (security_invoker = true)
AS
SELECT
    i.id,
    i.id AS internacao_id,
    i.id_atendimento,
    i.leito,
    p.nome AS usuario_nome,
    p.nome_mae,
    i.setor_clinica,
    p.municipio,
    acomp.nome AS acompanhante_nome,
    vis.nome AS visitante_ativo,
    i.status_internacao,
    i.data_internacao,
    i.data_alta,
    i.leito_anterior,
    cota.cota_maxima,
    coalesce(c.total_visitas, 0)::int AS cotas_usadas,
    'Visitantes: ' || coalesce(c.total_visitas, 0)::text || '/' || cota.cota_maxima::text AS placar
FROM public.internacoes i
JOIN public.pessoas p          ON p.id = i.paciente_id
LEFT JOIN public.pessoas acomp ON acomp.id = i.acompanhante_atual_id
LEFT JOIN public.pessoas vis   ON vis.id = i.visitante_atual_id
CROSS JOIN LATERAL (
    SELECT CASE
             WHEN lower(coalesce(i.setor_clinica, '')) LIKE '%vermelh%'
               OR lower(coalesce(i.leito, '')) LIKE '%vermelh%' THEN 1
             ELSE 2
           END AS cota_maxima
) cota
LEFT JOIN (
    SELECT internacao_id, count(*) AS total_visitas
      FROM public.credenciais
     WHERE tipo = 'VISITANTE'
       AND status <> 'CANCELADO'
       AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
     GROUP BY internacao_id
) c ON c.internacao_id = i.id;

REVOKE ALL ON public.pacientes FROM anon, PUBLIC;
GRANT SELECT ON public.pacientes TO authenticated;

-- =====================================================================
-- 6. POLÍTICAS DE ROW-LEVEL SECURITY (RLS) ESTITAS
-- =====================================================================

-- 6.1. Políticas em PESSOAS
DROP POLICY IF EXISTS "pessoas_select_setor" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_insert_setor" ON public.pessoas;
DROP POLICY IF EXISTS "pessoas_update_setor" ON public.pessoas;

CREATE POLICY "pessoas_select_setor" ON public.pessoas
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

CREATE POLICY "pessoas_insert_setor" ON public.pessoas
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "pessoas_update_setor" ON public.pessoas
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- 6.2. Políticas em INTERNACOES
DROP POLICY IF EXISTS "internacoes_select_setor" ON public.internacoes;
DROP POLICY IF EXISTS "internacoes_insert_setor" ON public.internacoes;
DROP POLICY IF EXISTS "internacoes_update_setor" ON public.internacoes;

CREATE POLICY "internacoes_select_setor" ON public.internacoes
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

CREATE POLICY "internacoes_insert_setor" ON public.internacoes
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "internacoes_update_setor" ON public.internacoes
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- 6.3. Políticas em CREDENCIAIS
DROP POLICY IF EXISTS "credenciais_select_setor" ON public.credenciais;
DROP POLICY IF EXISTS "credenciais_insert_setor" ON public.credenciais;
DROP POLICY IF EXISTS "credenciais_update_setor" ON public.credenciais;

CREATE POLICY "credenciais_select_setor" ON public.credenciais
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "credenciais_insert_setor" ON public.credenciais
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "credenciais_update_setor" ON public.credenciais
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- 6.4. Políticas em REGRAS_HORARIOS
DROP POLICY IF EXISTS "regras_select_setor" ON public.regras_horarios;
CREATE POLICY "regras_select_setor" ON public.regras_horarios
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

-- 6.5. Políticas em SLOTS_ORELHINHA
DROP POLICY IF EXISTS "slots_select_setor" ON public.slots_orelhinha;
DROP POLICY IF EXISTS "slots_insert_fono"   ON public.slots_orelhinha;
DROP POLICY IF EXISTS "slots_update_setor"  ON public.slots_orelhinha;

CREATE POLICY "slots_select_setor" ON public.slots_orelhinha
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

CREATE POLICY "slots_insert_fono" ON public.slots_orelhinha
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() = 'fono');

CREATE POLICY "slots_update_setor" ON public.slots_orelhinha
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

-- 6.6. Políticas em ALTAS
DROP POLICY IF EXISTS "altas_select_setor" ON public.altas;
DROP POLICY IF EXISTS "altas_insert_setor" ON public.altas;

CREATE POLICY "altas_select_setor" ON public.altas
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "altas_insert_setor" ON public.altas
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- =====================================================================
-- 7. FUNÇÕES RPC OFICIAIS (Transações atômicas com validação de regras)
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC 1: rpc_emitir_credencial_visitante
-- Cota Visitantes/Dia (Anti-revezamento):
-- - Normais (15h-16h): max 2/paciente/dia.
-- - Vermelha (16h-17h): max 1/paciente/dia.
-- - Bloqueio: Se COUNT(credenciais_VISITANTE_hoje) >= cota, impedir QR.
--   Erro exato: "Cota máxima atingida hoje".
-- - QR Code: Payload cego "HNSBC|TokenUUID" (zero dados sensíveis).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_emitir_credencial_visitante(
    p_paciente_id BIGINT,
    p_nome_visitante TEXT,
    p_documento TEXT DEFAULT NULL,
    p_telefone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_internacao RECORD;
    v_cota_max INTEGER := 2;
    v_qtd_hoje INTEGER := 0;
    v_agora TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
    v_janela_ini TIME;
    v_janela_fim TIME;
    v_token UUID;
    v_credencial_id UUID;
    v_pessoa_id BIGINT;
BEGIN
    -- 1. Autorização por perfil
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para emitir credenciais.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- 2. Localização da internação ativa.
    -- FOR UPDATE serializa check-ins simultâneos do mesmo paciente (evita furar a cota).
    SELECT * INTO v_internacao FROM public.internacoes WHERE id = p_paciente_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Internação / Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    IF v_internacao.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Operação inválida: Paciente já recebeu alta hospitalar.';
    END IF;

    IF p_nome_visitante IS NULL OR length(trim(p_nome_visitante)) < 2 THEN
        RAISE EXCEPTION 'Informe um nome de visitante válido (mínimo 2 caracteres).';
    END IF;

    -- 3. Definição da cota diária: Vermelha = 1, Normais = 2
    IF lower(coalesce(v_internacao.setor_clinica, '')) LIKE '%vermelh%'
       OR lower(coalesce(v_internacao.leito, '')) LIKE '%vermelh%' THEN
        v_cota_max := 1;
    ELSE
        v_cota_max := 2;
    END IF;

    -- 3b. Janela de horário: Normal 15h-16h / Vermelha 16h-17h (sem regra ativa, não bloqueia)
    SELECT horario_inicio, horario_fim INTO v_janela_ini, v_janela_fim
      FROM public.regras_horarios
     WHERE tipo_regra = CASE WHEN v_cota_max = 1 THEN 'Visita Vermelha' ELSE 'Visita Normal' END
       AND ativo = TRUE
     LIMIT 1;

    IF v_janela_ini IS NOT NULL AND v_janela_fim IS NOT NULL
       AND NOT (v_agora BETWEEN v_janela_ini AND v_janela_fim) THEN
        RAISE EXCEPTION 'FORA_HORARIO_VISITA: visita permitida apenas entre % e %',
            to_char(v_janela_ini, 'HH24:MI'), to_char(v_janela_fim, 'HH24:MI')
            USING ERRCODE = 'check_violation';
    END IF;

    -- 4. Contagem de credenciais de visitante emitidas hoje (Fuso SP)
    SELECT count(*) INTO v_qtd_hoje
      FROM public.credenciais
     WHERE internacao_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status <> 'CANCELADO'
       AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    -- 5. Anti-revezamento: Bloqueio estrito
    IF v_qtd_hoje >= v_cota_max THEN
        RAISE EXCEPTION 'Cota máxima atingida hoje'
            USING ERRCODE = 'P0001';
    END IF;

    -- 6. Cadastrar/localizar pessoa do visitante
    INSERT INTO public.pessoas (nome, cpf, telefone, tipo_pessoa)
    VALUES (trim(p_nome_visitante), trim(p_documento), trim(p_telefone), 'VISITANTE')
    RETURNING id INTO v_pessoa_id;

    -- 7. Emitir credencial com payload cego HNSBC|TokenUUID
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, v_pessoa_id, 'VISITANTE', trim(p_nome_visitante), trim(p_documento), trim(p_telefone), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- 8. Atualizar visitante ativo na internação
    UPDATE public.internacoes
       SET visitante_atual_id = v_pessoa_id
     WHERE id = p_paciente_id;

    -- 9. Auditoria
    INSERT INTO public.auditoria_portaria (internacao_id, acao, detalhes, usuario_id, usuario_email)
    VALUES (
        p_paciente_id,
        'EMISSAO_VISITANTE',
        jsonb_build_object('visitante', trim(p_nome_visitante), 'cota', (v_qtd_hoje + 1) || '/' || v_cota_max),
        auth.uid(),
        current_setting('request.jwt.claims', true)::jsonb ->> 'email'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'credencial_id', v_credencial_id,
        'token_qr', v_token,
        'qr_payload', 'HNSBC|' || v_token::text,
        'cotas_usadas', v_qtd_hoje + 1,
        'cota_maxima', v_cota_max,
        'placar', (v_qtd_hoje + 1)::text || '/' || v_cota_max::text,
        'visitante_ativo', trim(p_nome_visitante),
        'mensagem', 'Credencial de visitante emitida com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 2: rpc_trocar_acompanhante
-- Acompanhantes: Max 1 ativo. Trocas apenas 07:30-08:30 / 18:30-19:30.
-- Fluxo RPC: Revoga credencial atual + cadastra nova (atômico).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_trocar_acompanhante(
    p_paciente_id BIGINT,
    p_novo_acompanhante TEXT,
    p_documento TEXT DEFAULT NULL,
    p_telefone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_internacao RECORD;
    v_agora TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
    v_em_janela BOOLEAN;
    v_token UUID;
    v_credencial_id UUID;
    v_pessoa_id BIGINT;
    v_antigo_nome TEXT := NULL;
BEGIN
    -- 1. Autorização
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para troca de acompanhante.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- 2. Localizar internação ativa
    SELECT i.*, p.nome AS antigo_acomp_nome
      INTO v_internacao
      FROM public.internacoes i
      LEFT JOIN public.pessoas p ON p.id = i.acompanhante_atual_id
     WHERE i.id = p_paciente_id
     FOR UPDATE OF i;  -- impede duas trocas simultâneas (2 acompanhantes ativos)

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Internação não encontrada (ID: %).', p_paciente_id;
    END IF;

    IF v_internacao.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Operação inválida: Paciente já recebeu alta hospitalar.';
    END IF;

    IF p_novo_acompanhante IS NULL OR length(trim(p_novo_acompanhante)) < 2 THEN
        RAISE EXCEPTION 'Informe um nome de acompanhante válido (mínimo 2 caracteres).';
    END IF;

    v_antigo_nome := v_internacao.antigo_acomp_nome;

    -- 3. Validação de janela de horário caso já houvesse acompanhante anterior cadastrado
    IF v_internacao.acompanhante_atual_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.regras_horarios
             WHERE tipo_regra = 'Troca de Acompanhante'
               AND ativo = TRUE
               AND v_agora BETWEEN horario_inicio AND horario_fim
        ) INTO v_em_janela;

        IF NOT v_em_janela THEN
            RAISE EXCEPTION 'JANELA_TROCA: Troca permitida apenas entre 07:30-08:30 ou 18:30-19:30'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- 4. ATÔMICO: Revoga credencial atual ativa
    UPDATE public.credenciais
       SET status = 'REVOGADO', saida_em = now()
     WHERE internacao_id = p_paciente_id
       AND tipo = 'ACOMPANHANTE'
       AND status = 'ATIVO';

    -- 5. ATÔMICO: Cadastrar novo acompanhante
    INSERT INTO public.pessoas (nome, cpf, telefone, tipo_pessoa)
    VALUES (trim(p_novo_acompanhante), trim(p_documento), trim(p_telefone), 'ACOMPANHANTE')
    RETURNING id INTO v_pessoa_id;

    -- 6. ATÔMICO: Emitir nova credencial com payload cego
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, v_pessoa_id, 'ACOMPANHANTE', trim(p_novo_acompanhante), trim(p_documento), trim(p_telefone), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- 7. ATÔMICO: Atualizar acompanhante ativo na internação
    UPDATE public.internacoes
       SET acompanhante_atual_id = v_pessoa_id
     WHERE id = p_paciente_id;

    -- 8. Auditoria
    INSERT INTO public.auditoria_portaria (internacao_id, acao, detalhes, usuario_id, usuario_email)
    VALUES (
        p_paciente_id,
        'TROCA_ACOMPANHANTE',
        jsonb_build_object('anterior', v_antigo_nome, 'novo', trim(p_novo_acompanhante)),
        auth.uid(),
        current_setting('request.jwt.claims', true)::jsonb ->> 'email'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'credencial_id', v_credencial_id,
        'token_qr', v_token,
        'qr_payload', 'HNSBC|' || v_token::text,
        'acompanhante_anterior', v_antigo_nome,
        'acompanhante_atual', trim(p_novo_acompanhante),
        'mensagem', 'Troca de acompanhante realizada com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 3: rpc_confirmar_alta
-- Alta: Confirmação da Portaria -> altera status internação='ALTA'
-- -> libera leito -> revoga credenciais ativas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_confirmar_alta(
    p_paciente_id BIGINT,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_internacao RECORD;
    v_leito_liberado TEXT;
    v_revogadas_count INTEGER := 0;
BEGIN
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para confirmar altas.', coalesce(v_perfil, 'não autenticado');
    END IF;

    SELECT * INTO v_internacao FROM public.internacoes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Internação não encontrada (ID: %).', p_paciente_id;
    END IF;

    IF v_internacao.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Paciente já possui alta confirmada no sistema.';
    END IF;

    v_leito_liberado := v_internacao.leito;

    -- 1. ATÔMICO: Registra alta hospitalar
    INSERT INTO public.altas (
        internacao_id, leito_liberado, confirmado_por, observacoes, data_hora
    ) VALUES (
        p_paciente_id, v_leito_liberado, auth.uid(), p_observacoes, now()
    );

    -- 2. ATÔMICO: Revoga imediatamente todas as credenciais ativas do leito
    WITH revogadas AS (
        UPDATE public.credenciais
           SET status = 'REVOGADO', saida_em = now()
         WHERE internacao_id = p_paciente_id
           AND status = 'ATIVO'
        RETURNING id
    )
    SELECT count(*) INTO v_revogadas_count FROM revogadas;

    -- 3. ATÔMICO: Altera status internação='ALTA' e libera leito
    UPDATE public.internacoes
       SET status_internacao = 'ALTA',
           data_alta = now(),
           leito_anterior = v_leito_liberado,
           leito = 'ALTA / LIBERADO',
           visitante_atual_id = NULL,
           acompanhante_atual_id = NULL
     WHERE id = p_paciente_id;

    -- 4. Auditoria
    INSERT INTO public.auditoria_portaria (internacao_id, acao, detalhes, usuario_id, usuario_email)
    VALUES (
        p_paciente_id,
        'ALTA_HOSPITALAR',
        jsonb_build_object('leito_liberado', v_leito_liberado, 'credenciais_revogadas', v_revogadas_count),
        auth.uid(),
        current_setting('request.jwt.claims', true)::jsonb ->> 'email'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'paciente_id', p_paciente_id,
        'leito_liberado', v_leito_liberado,
        'credenciais_revogadas', v_revogadas_count,
        'mensagem', 'Alta hospitalar confirmada, leito liberado e credenciais revogadas com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 4: rpc_criar_slot_orelhinha (Fonoaudiologia)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_slot_orelhinha(
    p_data_exame DATE,
    p_horario TIME,
    p_turno TEXT DEFAULT 'MANHA',
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_slot_id BIGINT;
BEGIN
    IF v_perfil NOT IN ('fono') THEN
        RAISE EXCEPTION 'Acesso negado: Somente profissionais da Fonoaudiologia podem criar slots de exames.';
    END IF;

    INSERT INTO public.slots_orelhinha (
        data_exame, horario, turno, status, observacoes, criado_por
    ) VALUES (
        p_data_exame, p_horario, upper(coalesce(p_turno, 'MANHA')), 'DISPONIVEL', p_observacoes, auth.uid()
    ) RETURNING id INTO v_slot_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'slot_id', v_slot_id,
        'mensagem', 'Slot para Teste da Orelhinha criado com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 5: rpc_vincular_rn_orelhinha (Serviço Social)
-- Vincula RN (usar "RN de [Nome Mãe]" se s/ CPF).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_vincular_rn_orelhinha(
    p_slot_id BIGINT,
    p_paciente_id BIGINT,
    p_nome_rn TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_internacao RECORD;
    v_slot RECORD;
    v_nome_rn_final TEXT;
    v_mae TEXT;
BEGIN
    IF v_perfil NOT IN ('servico_social', 'portaria') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para vincular RN ao Teste da Orelhinha.', coalesce(v_perfil, 'não autenticado');
    END IF;

    SELECT * INTO v_slot FROM public.slots_orelhinha WHERE id = p_slot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot de agendamento não encontrado (ID: %).', p_slot_id;
    END IF;

    SELECT i.*, p.nome AS mae_nome, p.nome_mae AS mae_mae
      INTO v_internacao
      FROM public.internacoes i
      JOIN public.pessoas p ON p.id = i.paciente_id
     WHERE i.id = p_paciente_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Internação / Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    v_mae := coalesce(nullif(trim(v_internacao.mae_nome), ''), trim(v_internacao.mae_mae));

    -- Fallback obrigatório: se s/ CPF / nome específico, define "RN de [Nome Mãe]"
    IF p_nome_rn IS NULL OR trim(p_nome_rn) = '' THEN
        v_nome_rn_final := 'RN de ' || v_mae;
    ELSE
        v_nome_rn_final := trim(p_nome_rn);
    END IF;

    UPDATE public.slots_orelhinha
       SET internacao_id = p_paciente_id,
           nome_rn = v_nome_rn_final,
           nome_mae = v_mae,
           leito = v_internacao.leito,
           status = 'AGENDADO'
     WHERE id = p_slot_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'slot_id', p_slot_id,
        'nome_rn', v_nome_rn_final,
        'nome_mae', v_mae,
        'leito', v_internacao.leito,
        'mensagem', 'Recém-nascido vinculado com sucesso ao Teste da Orelhinha!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 6: rpc_liberar_acesso_orelhinha (Portaria)
-- Portaria: Liberação requer marcar checkboxes [x]Caderneta [x]Registro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_liberar_acesso_orelhinha(
    p_slot_id BIGINT,
    p_caderneta BOOLEAN,
    p_registro BOOLEAN,
    p_nome_responsavel TEXT DEFAULT NULL,
    p_documento TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_slot RECORD;
    v_token UUID;
    v_credencial_id UUID;
    v_pessoa_id BIGINT;
BEGIN
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para liberar acesso na Portaria.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- Validação estrita dos checkboxes obrigatórios
    IF NOT (coalesce(p_caderneta, false) AND coalesce(p_registro, false)) THEN
        RAISE EXCEPTION 'Liberação requer obrigatoriamente marcar os checkboxes [x] Caderneta de Vacinação e [x] Registro de Nascimento.'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_slot FROM public.slots_orelhinha WHERE id = p_slot_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot do Teste da Orelhinha não encontrado (ID: %).', p_slot_id;
    END IF;

    IF v_slot.internacao_id IS NULL THEN
        RAISE EXCEPTION 'SLOT_SEM_RN: o Serviço Social precisa vincular o RN a este horário antes da liberação.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_slot.status <> 'AGENDADO' THEN
        RAISE EXCEPTION 'Este agendamento não pode ser liberado (status atual: %).', v_slot.status;
    END IF;

    -- Cadastrar pessoa responsável
    INSERT INTO public.pessoas (nome, cpf, tipo_pessoa)
    VALUES (
        coalesce(nullif(trim(p_nome_responsavel), ''), v_slot.nome_rn, 'Responsável RN'),
        trim(p_documento),
        'ACOMPANHANTE'
    ) RETURNING id INTO v_pessoa_id;

    -- Emitir credencial com payload cego HNSBC|UUID
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, token_qr, status, criado_por
    ) VALUES (
        v_slot.internacao_id,
        v_pessoa_id,
        'ORELHINHA',
        coalesce(nullif(trim(p_nome_responsavel), ''), v_slot.nome_rn, 'Responsável RN'),
        trim(p_documento),
        v_token,
        'ATIVO',
        auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- Atualizar status do slot na Portaria
    UPDATE public.slots_orelhinha
       SET caderneta_vacinacao = TRUE,
           registro_nascimento = TRUE,
           status = 'LIBERADO_PORTARIA',
           liberado_por = auth.uid(),
           liberado_em = now(),
           credencial_id = v_credencial_id
     WHERE id = p_slot_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'slot_id', p_slot_id,
        'credencial_id', v_credencial_id,
        'token_qr', v_token,
        'qr_payload', 'HNSBC|' || v_token::text,
        'mensagem', 'Acesso ao Teste da Orelhinha liberado com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 7: rpc_obter_placar_cotas (Dashboard em Tempo Real)
-- Consulta a view pacientes (security_invoker aplica o RLS do usuário logado)
CREATE OR REPLACE FUNCTION public.rpc_obter_placar_cotas(p_paciente_id BIGINT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'paciente_id', v.id,
        'usuario_nome', v.usuario_nome,
        'leito', v.leito,
        'cotas_usadas', v.cotas_usadas,
        'cota_maxima', v.cota_maxima,
        'placar', v.placar,
        'pode_emitir', (v.cotas_usadas < v.cota_maxima AND v.status_internacao <> 'ALTA'),
        'visitante_ativo', v.visitante_ativo,
        'acompanhante_nome', v.acompanhante_nome,
        'status_internacao', v.status_internacao
    )
    FROM public.pacientes v
    WHERE v.id = p_paciente_id;
$$;

-- ---------------------------------------------------------------------
-- RPC 8: rpc_registrar_saida_visitante
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_registrar_saida_visitante(p_paciente_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
BEGIN
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para registrar saída.', coalesce(v_perfil, 'não autenticado');
    END IF;

    UPDATE public.credenciais
       SET status = 'UTILIZADO', saida_em = now()
     WHERE internacao_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status = 'ATIVO';

    UPDATE public.internacoes
       SET visitante_atual_id = NULL
     WHERE id = p_paciente_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'paciente_id', p_paciente_id,
        'mensagem', 'Saída do visitante registrada com sucesso!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 9: rpc_buscar_pacientes_autocomplete
-- Busca unificada com ordenação correta e segurança invoker
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_buscar_pacientes_autocomplete(p_termo TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_agg(to_jsonb(r) - 'internado' ORDER BY r.internado DESC, r.usuario_nome), '[]'::jsonb)
    FROM (
        SELECT v.*, (v.status_internacao = 'INTERNADO') AS internado
          FROM public.pacientes v
         WHERE trim(coalesce(p_termo, '')) = ''
            OR v.usuario_nome   ILIKE '%' || trim(p_termo) || '%'
            OR v.nome_mae       ILIKE '%' || trim(p_termo) || '%'
            OR v.leito          ILIKE '%' || trim(p_termo) || '%'
            OR v.id_atendimento ILIKE '%' || trim(p_termo) || '%'
         ORDER BY (v.status_internacao = 'INTERNADO') DESC, v.usuario_nome
         LIMIT 25
    ) r;
$$;

-- =====================================================================
-- 8. PERMISSÕES DE EXECUÇÃO DAS RPCs
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.rpc_emitir_credencial_visitante(BIGINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_trocar_acompanhante(BIGINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_alta(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_slot_orelhinha(DATE, TIME, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_rn_orelhinha(BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_obter_placar_cotas(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_saida_visitante(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_emitir_credencial_visitante(BIGINT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_trocar_acompanhante(BIGINT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_confirmar_alta(BIGINT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_criar_slot_orelhinha(DATE, TIME, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_vincular_rn_orelhinha(BIGINT, BIGINT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_obter_placar_cotas(BIGINT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_registrar_saida_visitante(BIGINT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) FROM anon, PUBLIC;

-- =====================================================================
-- 9. DADOS INICIAIS DE TESTE (Seed Idempotente)
-- =====================================================================
DO $$
DECLARE
    v_p1 BIGINT;
    v_p2 BIGINT;
    v_p3 BIGINT;
    v_p4 BIGINT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE nome = 'Severino da Silva') THEN
        INSERT INTO public.pessoas (nome, cpf, nome_mae, municipio, tipo_pessoa)
        VALUES ('Severino da Silva', '123.456.789-01', 'Maria das Dores Silva', 'Arapiraca - AL', 'PACIENTE')
        RETURNING id INTO v_p1;

        INSERT INTO public.internacoes (id_atendimento, paciente_id, leito, setor_clinica, status_internacao)
        VALUES ('ATD-2026-001', v_p1, 'Leito 101 - Clínica Médica', 'Clínica Médica', 'INTERNADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE nome = 'José Alves de Oliveira') THEN
        INSERT INTO public.pessoas (nome, cpf, nome_mae, municipio, tipo_pessoa)
        VALUES ('José Alves de Oliveira', '234.567.890-12', 'Ana Maria Alves', 'Palmeira dos Índios - AL', 'PACIENTE')
        RETURNING id INTO v_p2;

        INSERT INTO public.internacoes (id_atendimento, paciente_id, leito, setor_clinica, status_internacao)
        VALUES ('ATD-2026-002', v_p2, 'Leito 102 - Vermelha', 'Vermelha', 'INTERNADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE nome = 'Mariana Santos Lima') THEN
        INSERT INTO public.pessoas (nome, cpf, nome_mae, municipio, tipo_pessoa)
        VALUES ('Mariana Santos Lima', '345.678.901-23', 'Cláudia Santos', 'Arapiraca - AL', 'PACIENTE')
        RETURNING id INTO v_p3;

        INSERT INTO public.internacoes (id_atendimento, paciente_id, leito, setor_clinica, status_internacao)
        VALUES ('ATD-2026-003', v_p3, 'Maternidade 03', 'Maternidade', 'INTERNADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE nome = 'Enzo Gabriel dos Santos') THEN
        INSERT INTO public.pessoas (nome, cpf, nome_mae, municipio, tipo_pessoa)
        VALUES ('Enzo Gabriel dos Santos', '456.789.012-34', 'Camila dos Santos', 'Craíbas - AL', 'PACIENTE')
        RETURNING id INTO v_p4;

        INSERT INTO public.internacoes (id_atendimento, paciente_id, leito, setor_clinica, status_internacao)
        VALUES ('ATD-2026-004', v_p4, 'Pediatria 05', 'Pediatria', 'INTERNADO');
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 10. RECARREGAR O SCHEMA CACHE DO POSTGREST
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
