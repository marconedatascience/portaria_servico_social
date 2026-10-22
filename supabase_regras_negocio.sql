-- =====================================================================
-- CRM Portaria HNSBC - Regras de Negócio, RPCs Atômicas e RLS
-- Baseado nas diretrizes de .agents/regras_portaria.md
--
-- Local de Execução: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- URL: https://supabase.com/dashboard/project/mlzclvxlqiepvxzsxxgn/sql/new
--
-- REGRAS IMPLEMENTADAS:
-- 1. Cota Visitantes/Dia (Anti-revezamento):
--    - Normais (15h-16h): max 2/paciente/dia.
--    - Vermelha (16h-17h): max 1/paciente/dia.
--    - Bloqueio: Se COUNT(credenciais_VISITANTE_hoje) >= cota, impedir QR ("Cota máxima atingida hoje").
-- 2. Acompanhantes: Max 1 ativo. Trocas apenas 07:30-08:30 / 18:30-19:30.
--    - Fluxo RPC: Revoga credencial atual + cadastra nova (atômico).
-- 3. Orelhinha:
--    - Fono cria slots.
--    - Social vincula RN (fallback "RN de [Nome Mãe]" se s/ CPF).
--    - Portaria: Liberação requer marcar checkboxes [x] Caderneta [x] Registro.
-- 4. Alta:
--    - Confirmação da Portaria -> status internação='ALTA' -> libera leito -> revoga credenciais ativas.
-- 5. UI/UX & Integração:
--    - Busca: Autocomplete unificado (Nome, Mãe ou Leito).
--    - Dashboard: Placar de cotas em tempo real ("Visitantes: 1/2").
--    - QR Code: Payload cego "HNSBC|TokenUUID" (zero dados sensíveis).
--    - Supabase: RPCs com SECURITY DEFINER integradas a perfil_atual() e RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSÕES NECESSÁRIAS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. FUNÇÃO AUXILIAR: perfil_atual()
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
-- 3. TABELA DE PACIENTES (Aprimorada com colunas de suporte às regras)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pacientes (
    id                BIGSERIAL PRIMARY KEY,
    id_atendimento    VARCHAR(50) UNIQUE NOT NULL,
    leito             VARCHAR(50),
    usuario_nome      VARCHAR(255) NOT NULL,
    nome_mae          VARCHAR(255),
    setor_clinica     VARCHAR(100) DEFAULT 'Clínica Médica',
    municipio         VARCHAR(150),
    acompanhante_nome VARCHAR(255),
    visitante_ativo   VARCHAR(255),
    status_internacao VARCHAR(50) NOT NULL DEFAULT 'INTERNADO',
    data_internacao   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    data_alta         TIMESTAMPTZ,
    leito_anterior    VARCHAR(50)
);

-- Garantir adição de colunas caso a tabela já exista com esquema anterior
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'nome_mae') THEN
        ALTER TABLE public.pacientes ADD COLUMN nome_mae VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'setor_clinica') THEN
        ALTER TABLE public.pacientes ADD COLUMN setor_clinica VARCHAR(100) DEFAULT 'Clínica Médica';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'status_internacao') THEN
        ALTER TABLE public.pacientes ADD COLUMN status_internacao VARCHAR(50) NOT NULL DEFAULT 'INTERNADO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'data_alta') THEN
        ALTER TABLE public.pacientes ADD COLUMN data_alta TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'leito_anterior') THEN
        ALTER TABLE public.pacientes ADD COLUMN leito_anterior VARCHAR(50);
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. TABELA DE REGRAS DE HORÁRIOS (Parametrização)
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

-- Limpar e inserir horários oficiais de acordo com regras_portaria.md
DELETE FROM public.regras_horarios WHERE tipo_regra IN ('Visita Normal', 'Visita Vermelha', 'Troca de Acompanhante');

INSERT INTO public.regras_horarios (tipo_regra, descricao, horario_inicio, horario_fim, cota_maxima, setor_aplicavel, ativo)
VALUES
    ('Visita Normal', 'Visita Geral: Enfermarias, Clínicas e Maternidade (Máx 2/dia)', '15:00:00'::time, '16:00:00'::time, 2, 'Geral', TRUE),
    ('Visita Vermelha', 'Visita Área Vermelha / Críticos (Máx 1/dia)', '16:00:00'::time, '17:00:00'::time, 1, 'Vermelha', TRUE),
    ('Troca de Acompanhante', 'Janela da Manhã para Troca de Acompanhante', '07:30:00'::time, '08:30:00'::time, 1, 'Todos', TRUE),
    ('Troca de Acompanhante', 'Janela da Noite para Troca de Acompanhante', '18:30:00'::time, '19:30:00'::time, 1, 'Todos', TRUE);

-- ---------------------------------------------------------------------
-- 5. TABELA DE CREDENCIAIS DE ACESSO (QR Code Cego Anti-revezamento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credenciais_acesso (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id    BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    tipo           VARCHAR(50) NOT NULL, -- 'VISITANTE', 'ACOMPANHANTE', 'ORELHINHA', 'OBITO'
    nome_pessoa    VARCHAR(255) NOT NULL,
    documento      VARCHAR(50),
    telefone       VARCHAR(50),
    token_qr       UUID NOT NULL DEFAULT gen_random_uuid(),
    status         VARCHAR(50) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'UTILIZADO', 'REVOGADO', 'CANCELADO'
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    entrada_em     TIMESTAMPTZ,
    saida_em       TIMESTAMPTZ,
    criado_por     UUID DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_credenciais_paciente_data
    ON public.credenciais_acesso (paciente_id, tipo, criado_em);

CREATE INDEX IF NOT EXISTS idx_credenciais_token
    ON public.credenciais_acesso (token_qr);

-- ---------------------------------------------------------------------
-- 6. TABELA DE SLOTS DO TESTE DA ORELHINHA (Fonoaudiologia & Portaria)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slots_orelhinha (
    id                  BIGSERIAL PRIMARY KEY,
    data_exame          DATE NOT NULL,
    horario             TIME NOT NULL,
    turno               VARCHAR(20) DEFAULT 'MANHA',
    paciente_id         BIGINT REFERENCES public.pacientes(id) ON DELETE SET NULL,
    nome_rn             VARCHAR(255),
    nome_mae            VARCHAR(255),
    leito               VARCHAR(50),
    caderneta_vacinacao BOOLEAN NOT NULL DEFAULT FALSE,
    registro_nascimento BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(50) NOT NULL DEFAULT 'DISPONIVEL', -- 'DISPONIVEL', 'AGENDADO', 'LIBERADO_PORTARIA', 'REALIZADO', 'CANCELADO'
    observacoes         TEXT,
    credencial_id       UUID REFERENCES public.credenciais_acesso(id),
    criado_por          UUID DEFAULT auth.uid(),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    liberado_por        UUID,
    liberado_em         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_slots_orelhinha_data
    ON public.slots_orelhinha (data_exame, horario);

-- ---------------------------------------------------------------------
-- 7. TABELA DE ALTAS HOSPITALARES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.altas (
    id             BIGSERIAL PRIMARY KEY,
    paciente_id    BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    leito_liberado VARCHAR(50),
    confirmado_por UUID DEFAULT auth.uid(),
    observacoes    TEXT,
    data_hora      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_altas_paciente
    ON public.altas (paciente_id, data_hora DESC);

-- ---------------------------------------------------------------------
-- 8. AUDITORIA DE PACIENTES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_pacientes (
    id             BIGSERIAL PRIMARY KEY,
    paciente_id    BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    campo          VARCHAR(50) NOT NULL,
    valor_anterior VARCHAR(255),
    valor_novo     VARCHAR(255),
    usuario_id     UUID,
    usuario_email  TEXT,
    alterado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_pacientes_paciente
    ON public.auditoria_pacientes (paciente_id, alterado_em DESC);

CREATE OR REPLACE FUNCTION public.fn_auditar_paciente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
BEGIN
    IF NEW.visitante_ativo IS DISTINCT FROM OLD.visitante_ativo THEN
        INSERT INTO public.auditoria_pacientes
            (paciente_id, campo, valor_anterior, valor_novo, usuario_id, usuario_email)
        VALUES (NEW.id, 'visitante_ativo', OLD.visitante_ativo, NEW.visitante_ativo, auth.uid(), v_email);
    END IF;

    IF NEW.acompanhante_nome IS DISTINCT FROM OLD.acompanhante_nome THEN
        INSERT INTO public.auditoria_pacientes
            (paciente_id, campo, valor_anterior, valor_novo, usuario_id, usuario_email)
        VALUES (NEW.id, 'acompanhante_nome', OLD.acompanhante_nome, NEW.acompanhante_nome, auth.uid(), v_email);
    END IF;

    IF NEW.status_internacao IS DISTINCT FROM OLD.status_internacao THEN
        INSERT INTO public.auditoria_pacientes
            (paciente_id, campo, valor_anterior, valor_novo, usuario_id, usuario_email)
        VALUES (NEW.id, 'status_internacao', OLD.status_internacao, NEW.status_internacao, auth.uid(), v_email);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_paciente ON public.pacientes;
CREATE TRIGGER trg_auditar_paciente
    AFTER UPDATE ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_paciente();

-- ---------------------------------------------------------------------
-- 9. TRIGGER DE JANELA DE TROCA DE ACOMPANHANTE (Defesa em Profundidade)
--    Garante que qualquer UPDATE direto respeite as 2 janelas (07:30-08:30 ou 18:30-19:30)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_troca_acompanhante()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_agora TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
    v_em_janela BOOLEAN;
BEGIN
    -- Só valida se já havia acompanhante anterior e o nome está sendo alterado (troca)
    IF OLD.acompanhante_nome IS NOT NULL
       AND trim(OLD.acompanhante_nome) <> ''
       AND NEW.acompanhante_nome IS DISTINCT FROM OLD.acompanhante_nome THEN

        -- Verifica se o horário atual está dentro de alguma janela de troca ativa
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_troca_acompanhante ON public.pacientes;
CREATE TRIGGER trg_validar_troca_acompanhante
    BEFORE UPDATE OF acompanhante_nome ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_validar_troca_acompanhante();

-- =====================================================================
-- 10. RPCs OFICIAIS DO SISTEMA
-- =====================================================================

-- ---------------------------------------------------------------------
-- RPC 1: rpc_emitir_credencial_visitante
-- Anti-revezamento rigoroso:
-- Normais (15h-16h): max 2/paciente/dia.
-- Vermelha (16h-17h): max 1/paciente/dia.
-- Bloqueio com erro exato: "Cota máxima atingida hoje".
-- QR Code com payload cego: "HNSBC|TokenUUID".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_emitir_credencial_visitante(
    p_paciente_id INTEGER,
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
    v_paciente RECORD;
    v_cota_max INTEGER := 2;
    v_qtd_hoje INTEGER := 0;
    v_token UUID;
    v_credencial_id UUID;
BEGIN
    -- 1. Validação de perfil (RBAC)
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não possui autorização para emitir credenciais.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- 2. Localização e validação de status do paciente
    SELECT * INTO v_paciente FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    IF v_paciente.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Operação inválida: Paciente já recebeu alta hospitalar.';
    END IF;

    IF p_nome_visitante IS NULL OR length(trim(p_nome_visitante)) < 2 THEN
        RAISE EXCEPTION 'Informe um nome de visitante válido (mínimo 2 caracteres).';
    END IF;

    -- 3. Definição da cota máxima diária pelo setor do paciente
    IF lower(coalesce(v_paciente.setor_clinica, '')) LIKE '%vermelh%'
       OR lower(coalesce(v_paciente.leito, '')) LIKE '%vermelh%' THEN
        v_cota_max := 1;
    ELSE
        v_cota_max := 2;
    END IF;

    -- 4. Contagem de credenciais de visitante emitidas hoje para o paciente (Fuso SP)
    SELECT count(*) INTO v_qtd_hoje
      FROM public.credenciais_acesso
     WHERE paciente_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status <> 'CANCELADO'
       AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    -- 5. Anti-revezamento: Bloqueio estrito
    IF v_qtd_hoje >= v_cota_max THEN
        RAISE EXCEPTION 'Cota máxima atingida hoje'
            USING ERRCODE = 'P0001';
    END IF;

    -- 6. Emissão da credencial com payload cego HNSBC|UUID
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais_acesso (
        paciente_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, 'VISITANTE', trim(p_nome_visitante), trim(p_documento), trim(p_telefone), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- 7. Atualização do paciente
    UPDATE public.pacientes
       SET visitante_ativo = trim(p_nome_visitante)
     WHERE id = p_paciente_id;

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
-- Max 1 ativo. Trocas apenas 07:30-08:30 / 18:30-19:30.
-- Fluxo atômico: Revoga credencial atual + cadastra nova.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_trocar_acompanhante(
    p_paciente_id INTEGER,
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
    v_paciente RECORD;
    v_agora TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
    v_em_janela BOOLEAN;
    v_token UUID;
    v_credencial_id UUID;
    v_antigo_nome TEXT;
BEGIN
    -- 1. Validação de perfil
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para troca de acompanhante.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- 2. Localização do paciente
    SELECT * INTO v_paciente FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    IF v_paciente.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Operação inválida: Paciente já recebeu alta hospitalar.';
    END IF;

    IF p_novo_acompanhante IS NULL OR length(trim(p_novo_acompanhante)) < 2 THEN
        RAISE EXCEPTION 'Informe um nome de acompanhante válido (mínimo 2 caracteres).';
    END IF;

    -- 3. Validação de janela de horário caso já houvesse acompanhante anterior cadastrado
    v_antigo_nome := v_paciente.acompanhante_nome;
    IF v_antigo_nome IS NOT NULL AND trim(v_antigo_nome) <> '' THEN
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

    -- 4. ATÔMICO: Revoga credenciais de acompanhante ativas anteriores
    UPDATE public.credenciais_acesso
       SET status = 'REVOGADO', saida_em = now()
     WHERE paciente_id = p_paciente_id
       AND tipo = 'ACOMPANHANTE'
       AND status = 'ATIVO';

    -- 5. ATÔMICO: Emite nova credencial com payload cego
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais_acesso (
        paciente_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, 'ACOMPANHANTE', trim(p_novo_acompanhante), trim(p_documento), trim(p_telefone), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- 6. ATÔMICO: Atualiza nome na tabela de pacientes
    UPDATE public.pacientes
       SET acompanhante_nome = trim(p_novo_acompanhante)
     WHERE id = p_paciente_id;

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
-- Confirmação da Portaria -> altera status internação='ALTA'
-- -> libera leito -> revoga credenciais ativas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_confirmar_alta(
    p_paciente_id INTEGER,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_paciente RECORD;
    v_leito_liberado TEXT;
    v_revogadas_count INTEGER := 0;
BEGIN
    -- 1. Permissão: portaria ou serviço social
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não possui autorização para confirmar altas.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- 2. Localização do paciente
    SELECT * INTO v_paciente FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    IF v_paciente.status_internacao = 'ALTA' THEN
        RAISE EXCEPTION 'Paciente já possui alta confirmada no sistema.';
    END IF;

    v_leito_liberado := v_paciente.leito;

    -- 3. ATÔMICO: Registra alta na tabela de altas
    INSERT INTO public.altas (
        paciente_id, leito_liberado, confirmado_por, observacoes, data_hora
    ) VALUES (
        p_paciente_id, v_leito_liberado, auth.uid(), p_observacoes, now()
    );

    -- 4. ATÔMICO: Revoga todas as credenciais ativas do paciente
    WITH revogadas AS (
        UPDATE public.credenciais_acesso
           SET status = 'REVOGADO', saida_em = now()
         WHERE paciente_id = p_paciente_id
           AND status = 'ATIVO'
        RETURNING id
    )
    SELECT count(*) INTO v_revogadas_count FROM revogadas;

    -- 5. ATÔMICO: Atualiza paciente (status='ALTA', desocupa leito, limpa acompanhante e visitante)
    UPDATE public.pacientes
       SET status_internacao = 'ALTA',
           data_alta = now(),
           leito_anterior = v_leito_liberado,
           leito = 'ALTA / LIBERADO',
           visitante_ativo = NULL,
           acompanhante_nome = NULL
     WHERE id = p_paciente_id;

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
-- RPC 4: rpc_criar_slot_orelhinha (Exclusivo Fonoaudiologia)
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
    p_paciente_id INTEGER,
    p_nome_rn TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
    v_paciente RECORD;
    v_slot RECORD;
    v_nome_rn_final TEXT;
    v_mae TEXT;
BEGIN
    IF v_perfil NOT IN ('servico_social', 'portaria') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para vincular pacientes ao Teste da Orelhinha.', coalesce(v_perfil, 'não autenticado');
    END IF;

    SELECT * INTO v_slot FROM public.slots_orelhinha WHERE id = p_slot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot não encontrado (ID: %).', p_slot_id;
    END IF;

    SELECT * INTO v_paciente FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente / Mãe não encontrado (ID: %).', p_paciente_id;
    END IF;

    v_mae := coalesce(nullif(trim(v_paciente.nome_mae), ''), trim(v_paciente.usuario_nome));

    -- Fallback: Se não informado nome/CPF do RN, usar "RN de [Nome Mãe]"
    IF p_nome_rn IS NULL OR trim(p_nome_rn) = '' THEN
        v_nome_rn_final := 'RN de ' || v_mae;
    ELSE
        v_nome_rn_final := trim(p_nome_rn);
    END IF;

    UPDATE public.slots_orelhinha
       SET paciente_id = p_paciente_id,
           nome_rn = v_nome_rn_final,
           nome_mae = v_mae,
           leito = v_paciente.leito,
           status = 'AGENDADO'
     WHERE id = p_slot_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'slot_id', p_slot_id,
        'nome_rn', v_nome_rn_final,
        'nome_mae', v_mae,
        'leito', v_paciente.leito,
        'mensagem', 'Recém-nascido vinculado com sucesso ao Teste da Orelhinha!'
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 6: rpc_liberar_acesso_orelhinha (Portaria)
-- Portaria: Liberação requer marcar checkboxes [x]Caderneta [x]Registro.
-- Emite credencial com QR Code payload cego HNSBC|UUID.
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
BEGIN
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para liberar acesso na Portaria.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- Regra Estrita: Ambos checkboxes DEVEM ser verdadeiros
    IF NOT (coalesce(p_caderneta, false) AND coalesce(p_registro, false)) THEN
        RAISE EXCEPTION 'Liberação requer obrigatoriamente marcar os checkboxes [x] Caderneta de Vacinação e [x] Registro de Nascimento.'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_slot FROM public.slots_orelhinha WHERE id = p_slot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento do Teste da Orelhinha não encontrado (ID: %).', p_slot_id;
    END IF;

    -- Emissão de credencial de acesso com payload cego
    v_token := gen_random_uuid();

    INSERT INTO public.credenciais_acesso (
        paciente_id, tipo, nome_pessoa, documento, token_qr, status, criado_por
    ) VALUES (
        coalesce(v_slot.paciente_id, 0),
        'ORELHINHA',
        coalesce(nullif(trim(p_nome_responsavel), ''), v_slot.nome_rn, 'Responsável Orelhinha'),
        trim(p_documento),
        v_token,
        'ATIVO',
        auth.uid()
    ) RETURNING id INTO v_credencial_id;

    -- Atualiza slot na Portaria
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
-- RPC 7: rpc_obter_placar_cotas (Dashboard Placar em Tempo Real)
-- Retorna cotas calculadas e placar (Ex: "Visitantes: 1/2")
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_obter_placar_cotas(p_paciente_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_paciente RECORD;
    v_cota_max INTEGER := 2;
    v_qtd_hoje INTEGER := 0;
BEGIN
    SELECT * INTO v_paciente FROM public.pacientes WHERE id = p_paciente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paciente não encontrado (ID: %).', p_paciente_id;
    END IF;

    -- Cota por setor
    IF lower(coalesce(v_paciente.setor_clinica, '')) LIKE '%vermelh%'
       OR lower(coalesce(v_paciente.leito, '')) LIKE '%vermelh%' THEN
        v_cota_max := 1;
    ELSE
        v_cota_max := 2;
    END IF;

    -- Contagem de hoje
    SELECT count(*) INTO v_qtd_hoje
      FROM public.credenciais_acesso
     WHERE paciente_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status <> 'CANCELADO'
       AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    RETURN jsonb_build_object(
        'paciente_id', p_paciente_id,
        'usuario_nome', v_paciente.usuario_nome,
        'leito', v_paciente.leito,
        'cotas_usadas', v_qtd_hoje,
        'cota_maxima', v_cota_max,
        'placar', 'Visitantes: ' || v_qtd_hoje::text || '/' || v_cota_max::text,
        'pode_emitir', (v_qtd_hoje < v_cota_max AND v_paciente.status_internacao <> 'ALTA'),
        'visitante_ativo', v_paciente.visitante_ativo,
        'acompanhante_nome', v_paciente.acompanhante_nome,
        'status_internacao', v_paciente.status_internacao
    );
END;
$$;

-- ---------------------------------------------------------------------
-- RPC 8: rpc_registrar_saida_visitante
-- Desocupa o visitante ativo e marca saída na credencial
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_registrar_saida_visitante(p_paciente_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_perfil TEXT := public.perfil_atual();
BEGIN
    IF v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para registrar saída de visitantes.', coalesce(v_perfil, 'não autenticado');
    END IF;

    UPDATE public.credenciais_acesso
       SET status = 'UTILIZADO', saida_em = now()
     WHERE paciente_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status = 'ATIVO';

    UPDATE public.pacientes
       SET visitante_ativo = NULL
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
-- Busca unificada por Nome do Paciente, Nome da Mãe ou Leito
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_buscar_pacientes_autocomplete(p_termo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_termo TEXT := trim(coalesce(p_termo, ''));
    v_resultado JSONB;
BEGIN
    SELECT coalesce(jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'id_atendimento', p.id_atendimento,
            'leito', p.leito,
            'usuario_nome', p.usuario_nome,
            'nome_mae', p.nome_mae,
            'setor_clinica', p.setor_clinica,
            'municipio', p.municipio,
            'acompanhante_nome', p.acompanhante_nome,
            'visitante_ativo', p.visitante_ativo,
            'status_internacao', p.status_internacao,
            'data_internacao', p.data_internacao,
            'cota_maxima', (CASE WHEN lower(coalesce(p.setor_clinica, '')) LIKE '%vermelh%' OR lower(coalesce(p.leito, '')) LIKE '%vermelh%' THEN 1 ELSE 2 END),
            'cotas_usadas', coalesce(c.total_visitas, 0),
            'placar', 'Visitantes: ' || coalesce(c.total_visitas, 0)::text || '/' || (CASE WHEN lower(coalesce(p.setor_clinica, '')) LIKE '%vermelh%' OR lower(coalesce(p.leito, '')) LIKE '%vermelh%' THEN 1 ELSE 2 END)::text
        )
    ), '[]'::jsonb) INTO v_resultado
    FROM public.pacientes p
    LEFT JOIN (
        SELECT paciente_id, count(*) AS total_visitas
          FROM public.credenciais_acesso
         WHERE tipo = 'VISITANTE'
           AND status <> 'CANCELADO'
           AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
         GROUP BY paciente_id
    ) c ON c.paciente_id = p.id
    WHERE (
        v_termo = ''
        OR p.usuario_nome ILIKE '%' || v_termo || '%'
        OR coalesce(p.nome_mae, '') ILIKE '%' || v_termo || '%'
        OR coalesce(p.leito, '') ILIKE '%' || v_termo || '%'
        OR p.id_atendimento ILIKE '%' || v_termo || '%'
    )
    ORDER BY (p.status_internacao = 'INTERNADO') DESC, p.usuario_nome ASC
    LIMIT 25;

    RETURN v_resultado;
END;
$$;

-- ---------------------------------------------------------------------
-- 11. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) E POLÍTICAS
-- ---------------------------------------------------------------------
ALTER TABLE public.pacientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_horarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credenciais_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots_orelhinha    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_pacientes ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas existentes
DROP POLICY IF EXISTS "pacientes_select_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_insert_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "pacientes_update_setor"       ON public.pacientes;
DROP POLICY IF EXISTS "regras_select_setor"          ON public.regras_horarios;
DROP POLICY IF EXISTS "credenciais_select_setor"     ON public.credenciais_acesso;
DROP POLICY IF EXISTS "credenciais_insert_setor"     ON public.credenciais_acesso;
DROP POLICY IF EXISTS "credenciais_update_setor"     ON public.credenciais_acesso;
DROP POLICY IF EXISTS "slots_select_setor"           ON public.slots_orelhinha;
DROP POLICY IF EXISTS "slots_insert_fono"            ON public.slots_orelhinha;
DROP POLICY IF EXISTS "slots_update_setor"           ON public.slots_orelhinha;
DROP POLICY IF EXISTS "altas_select_setor"           ON public.altas;
DROP POLICY IF EXISTS "altas_insert_setor"           ON public.altas;

-- Políticas de Pacientes
CREATE POLICY "pacientes_select_setor" ON public.pacientes
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

CREATE POLICY "pacientes_insert_setor" ON public.pacientes
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "pacientes_update_setor" ON public.pacientes
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- Políticas de Regras de Horários
CREATE POLICY "regras_select_setor" ON public.regras_horarios
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social', 'fono'));

-- Políticas de Credenciais de Acesso
CREATE POLICY "credenciais_select_setor" ON public.credenciais_acesso
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "credenciais_insert_setor" ON public.credenciais_acesso
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "credenciais_update_setor" ON public.credenciais_acesso
    FOR UPDATE TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'))
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- Políticas de Slots da Orelhinha
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

-- Políticas de Altas
CREATE POLICY "altas_select_setor" ON public.altas
    FOR SELECT TO authenticated
    USING (public.perfil_atual() IN ('portaria', 'servico_social'));

CREATE POLICY "altas_insert_setor" ON public.altas
    FOR INSERT TO authenticated
    WITH CHECK (public.perfil_atual() IN ('portaria', 'servico_social'));

-- Revogar acesso de anônimos
REVOKE ALL ON public.pacientes          FROM anon;
REVOKE ALL ON public.regras_horarios    FROM anon;
REVOKE ALL ON public.credenciais_acesso FROM anon;
REVOKE ALL ON public.slots_orelhinha    FROM anon;
REVOKE ALL ON public.altas              FROM anon;
REVOKE ALL ON public.auditoria_pacientes FROM anon;

-- Permissões de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.rpc_emitir_credencial_visitante(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_trocar_acompanhante(INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_confirmar_alta(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_slot_orelhinha(DATE, TIME, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_rn_orelhinha(BIGINT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_obter_placar_cotas(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_saida_visitante(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) TO authenticated;

-- Revogar execução pública de anônimos
REVOKE ALL ON FUNCTION public.rpc_emitir_credencial_visitante(INTEGER, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_trocar_acompanhante(INTEGER, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_confirmar_alta(INTEGER, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_criar_slot_orelhinha(DATE, TIME, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_vincular_rn_orelhinha(BIGINT, INTEGER, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_obter_placar_cotas(INTEGER) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_registrar_saida_visitante(INTEGER) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) FROM anon, PUBLIC;

-- ---------------------------------------------------------------------
-- 12. DADOS INICIAIS DE TESTE / SEED (Opcional, idempotente)
-- ---------------------------------------------------------------------
INSERT INTO public.pacientes (id_atendimento, leito, usuario_nome, nome_mae, setor_clinica, municipio, status_internacao)
VALUES
    ('ATD-2026-001', 'Leito 101 - Clínica Médica', 'Severino da Silva', 'Maria das Dores Silva', 'Clínica Médica', 'Arapiraca - AL', 'INTERNADO'),
    ('ATD-2026-002', 'Leito 102 - Vermelha', 'José Alves de Oliveira', 'Ana Maria Alves', 'Vermelha', 'Palmeira dos Índios - AL', 'INTERNADO'),
    ('ATD-2026-003', 'Maternidade 03', 'Mariana Santos Lima', 'Cláudia Santos', 'Maternidade', 'Arapiraca - AL', 'INTERNADO'),
    ('ATD-2026-004', 'Pediatria 05', 'Enzo Gabriel dos Santos', 'Camila dos Santos', 'Pediatria', 'Craíbas - AL', 'INTERNADO')
ON CONFLICT (id_atendimento) DO NOTHING;
