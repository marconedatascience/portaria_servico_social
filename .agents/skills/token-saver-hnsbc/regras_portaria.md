# Ctx: App HNSBC Portaria
**Stack:** Next.js(App Router), Tailwind, Supabase(Postgres).
**Escopo:** Controle digital acesso, acompanhantes, altas, Orelhinha.

## Regras de Negócio
1. **Cota Visitantes/Dia (Anti-revezamento):**
   - Normais (15h-16h): max 2/paciente/dia.
   - Vermelha (16h-17h): max 1/paciente/dia.
   - *Bloqueio:* Se `COUNT(credenciais_VISITANTE_hoje) >= cota`, impedir QR. Erro: "Cota máxima atingida hoje".
2. **Acompanhantes:** Max 1 ativo. Trocas apenas 07:30-08:30 / 18:30-19:30. Fluxo RPC: Revoga atual + cadastra novo (atômico).
3. **Orelhinha:** Fono cria slots. Social vincula RN (usar "RN de [Nome Mãe]" se s/ CPF). Portaria: Liberação requer marcar checkboxes [x]Caderneta [x]Registro.
4. **Alta:** Confirmação da Portaria -> altera status internação='ALTA' -> libera leito -> revoga credenciais ativas.

## UI/UX & Integração
- **Busca:** Autocomplete unificado (Nome, Mãe ou Leito).
- **Dashboard:** Exibir placar de cotas (Ex: "Visitantes: 1/2").
- **QR Code:** Payload cego `HNSBC|TokenUUID` (Zero dados sensíveis).
- **Supabase:** Priorizar RPCs para transações complexas. Integrar com as regras de RLS e funções de JWT (`perfil_atual()`) já existentes no DB.