---
name: portaria-hnsbc-servico-social
description: Skill oficial completa do sistema Hospitalar HNSBC (Portaria, Serviço Social, Fono/Orelhinha, Supabase e Diretrizes de Otimização de Código)
version: 1.0.0
---

# 🏥 Skill Oficial: Portaria & Serviço Social - Hospital HNSBC

## 1. Contexto & Stack Tecnológica
- **Aplicação:** CRM & Controle Digital de Acesso Hospitalar (Portaria, Serviço Social e Fonoaudiologia).
- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query, Radix UI.
- **Backend:** FastAPI (Python), Uvicorn, Pydantic.
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL, Row Level Security - RLS, RPCs, Auth Admin).
- **Deploy:** Vercel (`marconedatascience-2608`) e Supabase Cloud.

---

## 2. Regras de Negócio Obrigatórias

### 2.1. Cota de Visitantes / Dia (Anti-Revezamento)
- **Clínicas Normais (15:00 às 16:00):** Limite de **2 visitantes** por paciente ao dia.
  - Setores: Clínica Médica, Clínica Cirúrgica, Maternidade e Pediatria.
- **Ala Vermelha (16:00 às 17:00):** Limite de **1 visitante** por paciente ao dia.
- **Bloqueio Automático:** Se `COUNT(credenciais_VISITANTE_hoje) >= cota`, impedir a emissão do QR Code e lançar erro claro:
  > *"Cota máxima de visitas atingida para este paciente hoje."*

### 2.2. Acompanhantes & Troca Segura
- **Limite:** Máximo de **1 acompanhante ativo** por paciente internado.
- **Janelas de Troca Permitidas:**
  - Manhã: `07:30 às 08:30`
  - Noite: `18:30 às 19:30`
- **Fluxo Atômico via RPC (`trocar_acompanhante`):**
  - O sistema revoga a credencial do acompanhante atual e registra o novo na mesma transação.
  - Regra de Portaria: *"Liberar primeiro a saída do atual, depois a entrada do novo acompanhante"*.

### 2.3. Teste da Orelhinha (Fonoaudiologia)
- **Fonoaudiólogo:** Cria e disponibiliza os slots de atendimento (Manhã / Tarde).
- **Serviço Social:** Vincula o Recém-Nascido (RN). Caso o RN não possua CPF próprio, padronizar o cadastro como: `"RN de [Nome da Mãe]"`.
- **Portaria (Confirmação de Liberação):** Liberação de acesso exige conferir e marcar obrigatoriamente os checkboxes:
  - `[x]` Caderneta de Vacinação
  - `[x]` Registro de Nascimento / Certidão

### 2.4. Liberação de Alta Hospitalar
- **Extinção do Livro Físico:** Tela exclusiva para a portaria registrar e confirmar a saída do paciente.
- **Transação de Alta:**
  - Status da internação alterado para `'ALTA'`.
  - Liberação imediata do leito para o sistema.
  - Revogação automática de todas as credenciais ativas do paciente e acompanhante.

---

## 3. Diretrizes de UI, UX & Segurança
- **Busca Rápida (Autocomplete Unificado):** Campo inteligente capaz de localizar o paciente por **Nome do Paciente**, **Nome da Mãe** ou **Número do Leito**.
- **Painel em Tempo Real (Dashboard):** Exibir placar visual de cotas (Exemplo: *"Visitantes: 1/2"*).
- **QR Code Seguro (Payload Cego):** O QR Code gerado contém apenas o token inviolável: `HNSBC|TokenUUID` (zero dados pessoais ou médicos expostos).
- **Supabase & RLS:** Priorizar Funções PostgreSQL (RPCs) para operações críticas e transacionais, integrando com perfis de acesso (`portaria`, `servico_social`, `fono`).

---

## 4. Diretrizes de Codificação & Economia de Tokens (Skill MD)
1. **Análise Direta:** Inspecione sintaxe, segurança (injeção SQL, vazamento de chaves, falta de validação Zod/Pydantic) e integridade.
2. **Respostas Econômicas:** Vá direto ao ponto, sem preâmbulos desnecessários ou explicações redundantes.
3. **Snippets Focados:** Não reescreva arquivos inteiros para correções pontuais; envie apenas os blocos que sofreram alteração.
4. **Padrões Limpos:** Mantenha separação clara de responsabilidades (Rotas, Controladores, Serviços Supabase e Componentes UI).
