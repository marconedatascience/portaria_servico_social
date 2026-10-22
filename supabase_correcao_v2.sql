-- =====================================================================
-- CRM PORTARIA HNSBC - CORREÇÃO V2 (rodar UMA vez, após supabase_script_completo.sql)
-- Supabase Dashboard -> SQL Editor -> New Query -> colar -> Run
--
-- Corrige:
--  1. [CRÍTICO] View public.pacientes ignorava o RLS (rodava como dono 'postgres')
--     e podia estar acessível ao papel anon. Agora: security_invoker + sem anon.
--  2. Placar real: a view passa a trazer cotas_usadas / cota_maxima / placar
--     contados a partir das credenciais do dia (fuso SP).
--  3. Janela de horário da visita: Normal 15h-16h / Vermelha 16h-17h.
--  4. Corrida na cota: dois check-ins simultâneos podiam furar a cota.
--     Agora a linha da internação é travada (FOR UPDATE) durante a emissão/troca.
--  5. Orelhinha: credencial caía na internação nº 1 quando o slot não tinha RN.
--  6. rpc_obter_placar_cotas e rpc_buscar_pacientes_autocomplete eram SECURITY
--     DEFINER sem checar perfil: qualquer conta logada (mesmo sem aprovação)
--     lia dados de pacientes. Agora rodam como o usuário (RLS se aplica).
--  7. rpc_buscar_pacientes_autocomplete tinha ORDER BY inválido junto de
--     jsonb_agg e falhava ao ser chamada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1 + 2. VIEW pacientes: respeita RLS e traz o placar real do dia
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.pacientes;

CREATE VIEW public.pacientes
WITH (security_invoker = true)   -- aplica o RLS de quem consulta, não do dono
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

-- ---------------------------------------------------------------------
-- 3 + 4. Emissão de visitante: janela de horário + trava contra corrida
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
    IF v_perfil IS NULL OR v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para emitir credenciais.', coalesce(v_perfil, 'não autenticado');
    END IF;

    -- FOR UPDATE: serializa check-ins simultâneos do mesmo paciente,
    -- impedindo que dois operadores furem a cota ao mesmo tempo.
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

    -- Cota: Vermelha = 1, Normais = 2
    IF lower(coalesce(v_internacao.setor_clinica, '')) LIKE '%vermelh%'
       OR lower(coalesce(v_internacao.leito, '')) LIKE '%vermelh%' THEN
        v_cota_max := 1;
    ELSE
        v_cota_max := 2;
    END IF;

    -- Janela de horário (lida de regras_horarios; sem regra ativa, não bloqueia)
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

    SELECT count(*) INTO v_qtd_hoje
      FROM public.credenciais
     WHERE internacao_id = p_paciente_id
       AND tipo = 'VISITANTE'
       AND status <> 'CANCELADO'
       AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    IF v_qtd_hoje >= v_cota_max THEN
        RAISE EXCEPTION 'Cota máxima atingida hoje'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.pessoas (nome, cpf, telefone, tipo_pessoa)
    VALUES (trim(p_nome_visitante), nullif(trim(p_documento), ''), nullif(trim(p_telefone), ''), 'VISITANTE')
    RETURNING id INTO v_pessoa_id;

    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, v_pessoa_id, 'VISITANTE', trim(p_nome_visitante),
        nullif(trim(p_documento), ''), nullif(trim(p_telefone), ''), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    UPDATE public.internacoes
       SET visitante_atual_id = v_pessoa_id
     WHERE id = p_paciente_id;

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
-- 4. Troca de acompanhante: trava a internação (evita 2 acompanhantes ativos)
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
    IF v_perfil IS NULL OR v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para troca de acompanhante.', coalesce(v_perfil, 'não autenticado');
    END IF;

    SELECT i.*, p.nome AS antigo_acomp_nome
      INTO v_internacao
      FROM public.internacoes i
      LEFT JOIN public.pessoas p ON p.id = i.acompanhante_atual_id
     WHERE i.id = p_paciente_id
     FOR UPDATE OF i;

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

    -- Primeiro cadastro é livre; TROCA só nas janelas oficiais
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

    UPDATE public.credenciais
       SET status = 'REVOGADO', saida_em = now()
     WHERE internacao_id = p_paciente_id
       AND tipo = 'ACOMPANHANTE'
       AND status = 'ATIVO';

    INSERT INTO public.pessoas (nome, cpf, telefone, tipo_pessoa)
    VALUES (trim(p_novo_acompanhante), nullif(trim(p_documento), ''), nullif(trim(p_telefone), ''), 'ACOMPANHANTE')
    RETURNING id INTO v_pessoa_id;

    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, telefone, token_qr, status, criado_por
    ) VALUES (
        p_paciente_id, v_pessoa_id, 'ACOMPANHANTE', trim(p_novo_acompanhante),
        nullif(trim(p_documento), ''), nullif(trim(p_telefone), ''), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

    UPDATE public.internacoes
       SET acompanhante_atual_id = v_pessoa_id
     WHERE id = p_paciente_id;

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
-- 5. Orelhinha: exige RN vinculado; nunca usa internação "padrão"
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
    v_nome TEXT;
BEGIN
    IF v_perfil IS NULL OR v_perfil NOT IN ('portaria', 'servico_social') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não autorizado para liberar acesso na Portaria.', coalesce(v_perfil, 'não autenticado');
    END IF;

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

    v_nome := coalesce(nullif(trim(p_nome_responsavel), ''), v_slot.nome_mae, v_slot.nome_rn);

    INSERT INTO public.pessoas (nome, cpf, tipo_pessoa)
    VALUES (v_nome, nullif(trim(p_documento), ''), 'ACOMPANHANTE')
    RETURNING id INTO v_pessoa_id;

    v_token := gen_random_uuid();

    INSERT INTO public.credenciais (
        internacao_id, pessoa_id, tipo, nome_pessoa, documento, token_qr, status, criado_por
    ) VALUES (
        v_slot.internacao_id, v_pessoa_id, 'ORELHINHA', v_nome,
        nullif(trim(p_documento), ''), v_token, 'ATIVO', auth.uid()
    ) RETURNING id INTO v_credencial_id;

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
-- 6. Placar: roda como o usuário (RLS se aplica; conta sem perfil vê nada)
-- ---------------------------------------------------------------------
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
-- 6 + 7. Autocomplete: roda como o usuário e com ORDER BY válido
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

-- Permissões (CREATE OR REPLACE preserva, mas reforçamos)
REVOKE ALL ON FUNCTION public.rpc_emitir_credencial_visitante(BIGINT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_trocar_acompanhante(BIGINT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_obter_placar_cotas(BIGINT) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_emitir_credencial_visitante(BIGINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_trocar_acompanhante(BIGINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_liberar_acesso_orelhinha(BIGINT, BOOLEAN, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_obter_placar_cotas(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_pacientes_autocomplete(TEXT) TO authenticated;

COMMIT;

-- =====================================================================
-- VERIFICAÇÃO (rode depois, separadamente):
--
-- a) A view precisa mostrar security_invoker=true:
--    SELECT relname, reloptions FROM pg_class WHERE relname = 'pacientes';
--
-- b) anon NÃO pode ter privilégio em nenhuma tabela/view com dados:
--    SELECT table_name, privilege_type FROM information_schema.role_table_grants
--     WHERE grantee = 'anon' AND table_schema = 'public';
--    (resultado esperado: nenhuma linha)
-- =====================================================================
