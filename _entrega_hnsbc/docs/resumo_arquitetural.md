# Resumo Arquitetural — Módulo Teste da Orelhinha (HNSBC)

**Hospital Regional Nossa Senhora do Bom Conselho (HNSBC)**  
**Módulo:** Triagem Auditiva Neonatal (Teste da Orelhinha)  
**Atores:** Fonoaudiologia, Portaria (Tablet touch), Serviço Social.  
**Data:** 28/10/2026  

---

## 1. Visão Geral e Decisões de Arquitetura

O módulo foi refatorado sob os princípios de Clean Architecture, Separation of Concerns e conformidade estrita com as diretrizes do HNSBC:

1. **RBAC em 3 Camadas:**
   - **Banco / Dados:** Tabela `config_fluxos` armazena a matriz de permissões (`perfis_leitura`, `perfis_edicao_agenda`, `perfis_edicao_demografico`, `campos_editaveis`).
   - **Cache & Invalidação:** Cache Redis com TTL e invalidação instantânea via `LISTEN/NOTIFY` do PostgreSQL quando `config_fluxos` é alterada. Fallback seguro: se a configuração estiver indisponível, nega por padrão (403).
   - **API (FastAPI + Pydantic v2):** Endpoints distintos (`/agenda/{id}` para agenda e `/agenda/{id}/demografico` para dados demográficos) com dependência de guarda que valida permissão **antes** da validação do corpo (evitando vazamento de 422 para quem não tem acesso). `extra="forbid"` em todos os schemas de entrada.
   - **UI (Next.js 16 + React 19):** A interface **nunca** decide permissões de forma hardcoded. Ela consome `permissoes_campos` da API e reflete visualmente.

2. **Lock Otimista (Concorrência):**
   - Coluna `versao` inteira em cada registro.
   - Requisições de alteração exigem cabeçalho `If-Match: "{versao}"` (retornando `428 Precondition Required` se ausente).
   - Se a versão no banco divergir, a API retorna `409 Conflict` com o registro atualizado (com PII ofuscada para quem não tem acesso).

3. **Idempotência e Offline-First (Tablet da Portaria):**
   - As edições demográficas geram um `operation_id` (UUID v4) no cliente e entram em fila no IndexedDB/localStorage via Zustand.
   - Se a rede oscilar ou o tablet estiver offline, a Portaria continua preenchendo. Ao restabelecer a conexão, o cliente sincroniza em segundo plano com retry e backoff exponencial.
   - No backend, a tabela `orelhinha_operacoes_idempotencia` armazena o hash dos campos e a versão gerada. Reexecuções com o mesmo `operation_id` retornam `200 OK` com o cabeçalho `Idempotent-Replay: true` e não duplicam gravação nem incrementam versão extra.
   - **Data/Hora do exame nunca entram na fila offline**: são autoridade exclusiva da Fonoaudiologia e exigem conectividade ativa.

4. **Tratamento de Datas e Fusos:**
   - Proibido uso de `new Date("YYYY-MM-DD")` que provocaria deslocamento em UTC-3 (`America/Maceio`).
   - Datas são tratadas como valores puros de calendário (strings no formato ISO `YYYY-MM-DD`). Aritmética de dias é feita sem efeitos colaterais de timezone.

5. **UI/UX Hospitalar Limpa (Tablet-First):**
   - Superfície única sem cards aninhados nem sombras excessivas.
   - Remoção do gradiente roxo pesado em favor de paleta neutra em slate com acento em sky blue.
   - Remoção da coluna redundante "Permissão" e das pílulas "Alteração bloqueada".
   - Bloqueio comunicado de forma discreta por ícone de cadeado (`<Lock />`) no cabeçalho das colunas Data e Hora, com tooltip e rótulo acessível.
   - Alvos de toque (touch targets) >= 44px e fontes de corpo >= 14px (secundárias >= 12px), com no máximo 2 pesos de fonte.
   - Coluna expansível para telas de tablet (< xl) para visualização rápida dos dados demográficos.
   - Painel lateral (`EditSheet`) para a Portaria, garantindo que o teclado virtual do tablet não cubra a lista de pacientes.
   - Ofuscação de dados sensíveis na tabela (LGPD): Cartão SUS e Telefone aparecem parcialmente mascarados na listagem pública.

---

## 2. Inventário de Arquivos Entregues

### Backend (`_entrega_hnsbc/backend/`)
- `core/config_fluxos.py`: Provedor assíncrono de configurações com cache Redis, TTL e fallback.
- `core/erros.py`: Exceções de domínio (`PermissaoNegada`, `ConflitoVersao`, `NaoEncontrado`, `RegraNegocio`, `ConfigIndisponivel`).
- `core/perfil.py`: Extração e resolução de perfil do usuário via JWT ou cabeçalho de dev.
- `core/validators.py`: Validações puras do CNS (algoritmo módulo 11 oficial), telefones brasileiros e datas.
- `core/orelhinha_wiring.py`: Lifespan do FastAPI com pool assíncrono `asyncpg`, Redis opcional e listener `LISTEN/NOTIFY`.
- `repositories/orelhinha_repository.py`: Interface tipada do repositório.
- `repositories/orelhinha_repository_pg.py`: Implementação PostgreSQL com lock otimista e idempotência por `operation_id`.
- `routers/orelhinha.py`: Router FastAPI RESTful com guarda de permissões, `If-Match`, `ETag`, `Idempotent-Replay` e tradução de erros de domínio.
- `schemas/orelhinha.py`: Schemas Pydantic v2 com `extra="forbid"` (`OrelhinhaAgendaUpdate`, `OrelhinhaDemograficoUpdate`, etc.).
- `services/orelhinha_service.py`: Regras de negócio, verificação de retroatividade, janela de horário e ofuscação LGPD.
- `requirements.txt` / `requirements-dev.txt` / `pytest.ini`: Dependências e configurações de execução.
- `tests/`: 45 testes automatizados (RBAC, concorrência 409, replay idempotente, validadores).

### Supabase / Banco de Dados (`_entrega_hnsbc/supabase/`)
- `migrations/20261028_orelhinha_rbac.sql`:
  - Criação da tabela `config_fluxos` e trigger de `NOTIFY config_fluxos_changed`.
  - Tabela `orelhinha_operacoes_idempotencia` para idempotência.
  - Tabela `auditoria_orelhinha` com registro de autor, campo alterado, valor antigo, novo e timestamp (sem vazamento de PII em logs de aplicação).
  - Adição da coluna `versao` (DEFAULT 1) na tabela `agenda_orelhinha`.
  - Políticas de RLS estritas baseadas em `perfil_atual()`.

### Frontend (`_entrega_hnsbc/frontend/`)
- `src/lib/masks/`:
  - `unmask.ts`: Remoção pura de caracteres não numéricos.
  - `cartaoSus.ts`: Máscara `000.0000.0000.0000` (15 dígitos).
  - `data.ts`: Máscara `DD/MM/AAAA` com tratamento de datas ISO coladas.
  - `hora.ts`: Máscara `HH:mm`.
  - `telefone.ts`: Máscara dinâmica para fixo (10 dígitos) e celular (11 dígitos).
  - `cursor.ts`: Cálculo e preservação de posição do cursor e tratamento de backspace sobre separadores.
  - `index.ts`: Exportação central e funções de ofuscação LGPD (`ocultarCartaoSus`, `ocultarTelefone`).
- `src/lib/validators/`:
  - `calendario.ts`: Validações de bissexto, dias no mês, conversão ISO/BR sem deslocamento de timezone, `hojeIso` em Maceió e soma de dias de calendário.
  - `documentos.ts`: Validação de CNS e telefones brasileiros.
- `src/lib/schemas/orelhinha.ts`: Contratos Zod espelhados no Pydantic v2, validação de inputs e `safeParse` com mensagens em português.
- `src/lib/sync/`:
  - `offlineQueue.ts`: Store Zustand com persistência para fila de alterações demográficas da Portaria, `operation_id` e retry com backoff exponencial.
  - `diff.ts`: Cálculo de diff demográfico para envio de payload mínimo.
- `src/lib/api/orelhinhaClient.ts`: Cliente HTTP com suporte a Zod, `If-Match`, tratamento de 409 e headers de versão.
- `src/hooks/`:
  - `useOrelhinhaPermissoes.ts`: Consumo e cache da matriz de permissões.
  - `useOrelhinhaAgenda.ts`: Listagem de agenda com updates otimistas para Fonoaudiologia e envio resiliente para Portaria.
  - `useOrelhinhaSync.ts`: Sincronização Realtime (com fallback de polling 20s), anúncio `aria-live` e processador da fila offline.
- `src/components/orelhinha/`:
  - `MaskedField.tsx`: Campo mascarado acessível com preservação de cursor, feedback de erro no blur/submit e touch target >= 44px.
  - `EditSheet.tsx`: Side sheet lateral para Portaria/Social que evita cobertura da tela pelo teclado virtual do tablet.
  - `OrelhinhaRow.tsx`: Linha da tabela com altura >= 48px, edição inline (Enter/Esc) para Fonoaudiologia, linha expansível no tablet e status semântico discreto.
  - `OrelhinhaTable.tsx`: Superfície única da agenda com cabeçalho limpo, busca local rápida, estados de loading/empty/error e badge de pendências offline.
- `src/tests/`:
  - `masks.test.ts`: 14 testes cobrindo digitação, colagem e backspace sobre separadores.
  - `validators.test.ts`: 15 testes cobrindo bissextos, 31/02, CNS oficial, telefones e regras de negócio Zod.
  - `queue.test.ts`: 5 testes cobrindo enfileiramento offline, UUIDs e diff de dados.

---

## 3. Justificativa de Dependências Novas

| Dependência | Camada | Justificativa Técnica |
| :--- | :--- | :--- |
| `zustand` | Frontend | Gerenciamento de estado da fila offline com middleware `persist` leve (< 3kB), sem o overhead do Redux e compatível com React 19. |
| `vitest` + `vite` | Frontend (Dev) | Execução veloz dos testes unitários das funções puras de máscara, validadores e fila com suporte nativo a ESM e TypeScript. |
| `asyncpg` | Backend | Driver assíncrono nativo de alta performance para PostgreSQL com suporte a `LISTEN/NOTIFY` para invalidação de cache em tempo real. |
| `redis` | Backend | Cliente assíncrono para cache da matriz `config_fluxos` com TTL e invalidação via NOTIFY. |

---

## 4. Tabela de Verificação dos Critérios de Aceite

| Critério de Aceite | Status | Verificação |
| :--- | :---: | :--- |
| Portaria não consegue alterar Data/Hora (UI, API e banco) | ✅ Concluído | Bloqueado na UI (sem affordance de edição), na API (guarda retorna 403 antes de ler o corpo) e no banco (RLS). Testado em `test_rbac.py`. |
| Mudança da Fono aparece na Portaria sem recarregar a página | ✅ Concluído | Invalidação via canal Realtime do Supabase (com fallback de polling a cada 20s) e destaque sutil da linha por ~2s. |
| Máscaras corretas ao digitar, apagar e colar; datas inválidas rejeitadas | ✅ Concluído | Funções puras em `src/lib/masks/` com teste de backspace sobre separador e rejeição de 31/02 ou 29/02 não bissexto. 14 testes em `masks.test.ts`. |
| Dado salvo sem máscara; datas sem deslocamento de fuso | ✅ Concluído | Normalização via Zod/unmask antes do envio; tratamento estrito como string de calendário ISO `YYYY-MM-DD`. |
| Nenhuma regra de permissão hardcoded; matriz vem de `config_fluxos` | ✅ Concluído | Matriz armazenada na tabela `config_fluxos`, cacheada no Redis e consumida via endpoint `/permissoes`. O front apenas reflete `permissoes_campos`. |
| Coluna "Permissão" e pílulas repetidas removidas; fontes >= 14px; alvos >= 44px | ✅ Concluído | Removidas todas as pílulas repetidas. Indicador discreto de cadeado no cabeçalho. Todos os botões e inputs possuem `min-h-[44px]` e tipografia WCAG AA. |
| Edição demográfica funciona offline e sincroniza sem duplicar | ✅ Concluído | Fila no IndexedDB com `operation_id` (UUID), retry com backoff exponencial e tabela de idempotência no backend. Testado em `test_sync.py` e `queue.test.ts`. |
| Zod no front, Pydantic v2 no back, I/O async, sem `any` | ✅ Concluído | Contratos espelhados, tipagem estrita com TypeScript e Pydantic v2 `extra="forbid"`, queries 100% assíncronas. |
| Dependências novas justificadas | ✅ Concluído | Documentadas na seção 3 deste documento. |

---

## 5. Resultados dos Testes Automatizados

### Backend (Pytest):
```
============================= 45 passed in 1.97s ==============================
- test_rbac.py: 15 passed
- test_sync.py: 8 passed
- test_validators.py: 22 passed
```

### Frontend (Vitest):
```
 Test Files  3 passed (3)
      Tests  34 passed (34)
- masks.test.ts: 14 passed
- validators.test.ts: 15 passed
- queue.test.ts: 5 passed
```

**Total:** 79 testes unitários e de integração executados com 100% de sucesso.
