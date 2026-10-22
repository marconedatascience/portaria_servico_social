// Traduz as mensagens de erro do Supabase Auth (que vêm em inglês) para português.
export function traduzirErroAuth(mensagem?: string): string {
  if (!mensagem) return 'Erro inesperado. Tente novamente.';
  const m = mensagem.toLowerCase();

  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('security purposes'))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  if (m.includes('user not found')) return 'Usuário não encontrado.';
  if (m.includes('same as the old') || m.includes('should be different'))
    return 'A nova senha deve ser diferente da senha anterior.';
  if (m.includes('weak password') || m.includes('password should be'))
    return 'Senha fraca. Use no mínimo 8 caracteres, com maiúscula, número e caractere especial.';
  if (m.includes('auth session missing') || m.includes('session') && m.includes('expired'))
    return 'Sessão expirada ou link inválido. Solicite um novo link de acesso.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'Cadastro desativado. Solicite seu acesso à administração.';
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Sem conexão com o servidor. Verifique sua internet.';
  if (m.includes('error sending') || m.includes('smtp'))
    return 'Falha ao enviar o e-mail. Contate o suporte de TI.';

  return 'Não foi possível concluir a operação. Tente novamente.';
}
