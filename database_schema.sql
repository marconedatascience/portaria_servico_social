-- CRM Portaria HNSBC - Database Schema

-- Tabela de Pacientes / Leitos (O Dashboard 360º)
CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    id_atendimento VARCHAR(50) UNIQUE NOT NULL,
    leito VARCHAR(50) NOT NULL,
    usuario_nome VARCHAR(255) NOT NULL,
    municipio VARCHAR(150),
    acompanhante_nome VARCHAR(255),
    visitante_ativo VARCHAR(255),
    data_internacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Regras de Horários e Fluxos
CREATE TABLE regras_horarios (
    id SERIAL PRIMARY KEY,
    tipo_regra VARCHAR(100) NOT NULL, -- Ex: 'Visita Vermelha', 'Troca de Acompanhante', 'Teste da Orelhinha', 'Liberação de Óbito'
    descricao TEXT NOT NULL,
    horario_inicio TIME,
    horario_fim TIME,
    setor_aplicavel VARCHAR(100) DEFAULT 'Todos',
    ativo BOOLEAN DEFAULT TRUE
);

-- Inserindo as regras baseadas no portaria_servico_social.docx
INSERT INTO regras_horarios (tipo_regra, descricao, horario_inicio, horario_fim) VALUES
('Visita Vermelha', 'Horário para visitação na área vermelha', '16:00:00', '17:00:00'),
('Troca de Acompanhante', 'Horário permitido para troca de acompanhantes', '07:30:00', '08:30:00'),
('Teste da Orelhinha', 'Fluxo para liberação e acesso ao Teste da Orelhinha', NULL, NULL),
('Liberação de Óbito', 'Fluxo para liberação de familiares em caso de óbito', NULL, NULL);
