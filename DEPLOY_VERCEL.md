# Procedimento de Publicação na Vercel

Conta/Organização: **marconedatascience-2608**  
Link do Painel: [https://vercel.com/marconedatascience-2608](https://vercel.com/marconedatascience-2608)

---

## Método 1: Publicação Rápida via Terminal (Recomendado)

Foi criado o script executável [`publicar_vercel.bat`](file:///c:/Users/marcone/Documents/portaria_serivco_social/publicar_vercel.bat) na raiz do projeto.

1. Dê um **duplo clique** em `publicar_vercel.bat` (ou abra um terminal e execute `npx vercel --prod` dentro da pasta `frontend`).
2. Se for a primeira vez, o navegador abrirá para você confirmar o login na Vercel.
3. Responda às perguntas do assistente:
   - **Set up and deploy?** `Y` (Sim)
   - **Which scope?** Selecione `marconedatascience-2608`
   - **Link to existing project?** `N` (se for novo) ou `Y` (se já criou no painel)
   - **What's your project's name?** `portaria-hnsbc` (ou o nome que desejar)
   - **In which directory is your code located?** `./` (aperte Enter)
   - **Want to modify settings?** `N` (aperte Enter)
4. Ao final, a Vercel gerará o domínio de produção (ex.: `https://portaria-hnsbc.vercel.app`).

---

## Método 2: Publicação via Painel Web da Vercel

1. Acesse o painel: [vercel.com/marconedatascience-2608](https://vercel.com/marconedatascience-2608).
2. Clique no botão **"Add New..."** ➔ **"Project"**.
3. Se o código estiver em um repositório Git (GitHub/GitLab), selecione o repositório.
4. Na tela de configuração:
   - **Root Directory:** Clique em `Edit` e selecione a pasta `frontend`.
   - **Framework Preset:** `Next.js`.
   - **Build Command:** `npm run build` (padrão).
5. Em **Environment Variables**, adicione as variáveis do arquivo [`.env.example`](file:///c:/Users/marcone/Documents/portaria_serivco_social/frontend/.env.example):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://mlzclvxlqiepvxzsxxgn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_c_xiPCaKv07_80YCmWZJUQ_wdH4dmgm`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_c_xiPCaKv07_80YCmWZJUQ_wdH4dmgm`
   - `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_jD-foHcLElrb1YKKI0ODCQ_svpHn7H4`
   - `CADASTRO_DOMINIOS_PERMITIDOS` = `*`
6. Clique em **Deploy**.

---

## Variáveis de Ambiente Obrigatórias na Vercel

Seja pelo método 1 ou 2, certifique-se de que as variáveis abaixo estejam cadastradas em **Project Settings > Environment Variables** na Vercel:

| Variável | Valor |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mlzclvxlqiepvxzsxxgn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_c_xiPCaKv07_80YCmWZJUQ_wdH4dmgm` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_c_xiPCaKv07_80YCmWZJUQ_wdH4dmgm` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_jD-foHcLElrb1YKKI0ODCQ_svpHn7H4` |
| `CADASTRO_DOMINIOS_PERMITIDOS` | `*` |
