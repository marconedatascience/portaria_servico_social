import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Chaves SOMENTE via variáveis de ambiente (.env.local). Nunca deixar valores fixos no código.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MINIMA = 8;

// Domínios de e-mail aceitos no cadastro, separados por vírgula (ex.: "hnsbc.org.br").
// Se estiver vazio ou contiver '*', permite qualquer domínio válido.
const DOMINIOS_PERMITIDOS = (process.env.CADASTRO_DOMINIOS_PERMITIDOS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Cadastro indisponível: SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL ausentes.');
    return NextResponse.json({ error: 'Serviço de cadastro indisponível.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const { email, password, setor } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    setor?: unknown;
  };
  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const senha = typeof password === 'string' ? password : '';
  const setorEscolhido = typeof setor === 'string' && ['portaria', 'servico_social', 'fono'].includes(setor.toLowerCase())
    ? setor.toLowerCase()
    : 'portaria';

  if (!EMAIL_REGEX.test(emailNormalizado) || emailNormalizado.length > 254) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const dominio = emailNormalizado.split('@').pop() ?? '';
  const permiteQualquerDominio = DOMINIOS_PERMITIDOS.length === 0 || DOMINIOS_PERMITIDOS.includes('*');

  if (!permiteQualquerDominio && !DOMINIOS_PERMITIDOS.includes(dominio)) {
    const lista = DOMINIOS_PERMITIDOS.map((d) => `@${d}`).join(', ');
    return NextResponse.json(
      { error: `Use seu e-mail institucional (${lista}).` },
      { status: 400 }
    );
  }

  if (senha.length < SENHA_MINIMA || senha.length > 72) {
    return NextResponse.json(
      { error: `A senha deve ter entre ${SENHA_MINIMA} e 72 caracteres.` },
      { status: 400 }
    );
  }

  try {
    // 0. Tenta primeiro o endpoint de cadastro no backend FastAPI local se estiver configurado
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      const respBackend = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1/auth/cadastrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalizado, password: senha, setor: setorEscolhido }),
        signal: AbortSignal.timeout(3000),
      });
      if (respBackend.ok) {
        const dados = await respBackend.json();
        return NextResponse.json(dados);
      }
    } catch {
      // Backend local offline ou rota não atingida, segue fluxo do Supabase
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Verificar se a conta já existe para atualizar senha/perfil sem travar o operador
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const usuarioExistente = userList?.users?.find(
      (u) => u.email && u.email.trim().toLowerCase() === emailNormalizado
    );

    if (usuarioExistente) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(usuarioExistente.id, {
        password: senha,
        app_metadata: {
          ...(usuarioExistente.app_metadata || {}),
          role: setorEscolhido,
          setor: setorEscolhido,
        },
      });

      if (updateError) {
        console.error('Erro ao atualizar usuário existente:', updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Senha e perfil (${setorEscolhido.toUpperCase()}) atualizados com sucesso! Você já pode fazer login.`,
      });
    }

    // 2. Criar nova conta já aprovada para o setor selecionado
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: senha,
      email_confirm: true,
      app_metadata: {
        role: setorEscolhido,
        setor: setorEscolhido,
      },
    });

    if (createError) {
      console.error('Erro ao cadastrar usuário:', createError.message);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Conta criada com sucesso com perfil ${setorEscolhido.toUpperCase()}! Você já pode fazer login.`,
    });
  } catch (err: unknown) {
    const rawMsg = (err as Error)?.message || '';
    console.error('Exceção ao cadastrar:', rawMsg);
    const msg = rawMsg.toLowerCase().includes('fetch failed') || rawMsg.toLowerCase().includes('failed to fetch')
      ? 'Falha de comunicação com o servidor. Verifique se o serviço está ativo.'
      : (rawMsg || 'Erro inesperado no servidor de autenticação.');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
