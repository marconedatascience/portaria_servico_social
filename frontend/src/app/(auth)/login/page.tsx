"use client";

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { traduzirErroAuth } from '../../../lib/authErrors';

const loginSchema = z.object({
  email: z.string().email('Formato de e-mail inválido.'),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

type LoginForm = z.infer<typeof loginSchema>;

const NOMES_SETORES: Record<string, { nome: string; cor: string }> = {
  portaria: { nome: "Controle de Acesso - Portaria", cor: "bg-blue-100 text-primary-blue border-blue-200" },
  fono: { nome: "Fonoaudiologia - Teste da Orelhinha", cor: "bg-purple-100 text-purple-700 border-purple-200" },
  servico_social: { nome: "Serviço Social - Acolhimento Humanizado", cor: "bg-green-100 text-primary-green border-green-200" },
};

function LoginFormContent() {
  const [authError, setAuthError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const setorParam = searchParams.get('setor')?.toLowerCase() || '';
  const setorConfig = NOMES_SETORES[setorParam] || {
    nome: "Sistema Integrado de Acesso Hospitalar",
    cor: "bg-slate-100 text-slate-700 border-slate-200"
  };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const onSubmit = async (data: LoginForm) => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });

    if (error) {
      setAuthError(traduzirErroAuth(error.message));
    } else {
      // Redirecionamento dinâmico baseado no setor se especificado
      if (setorParam === 'portaria') router.replace('/dashboard/portaria');
      else if (setorParam === 'fono') router.replace('/dashboard/fono');
      else router.replace('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-slate-50 to-green-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 p-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_hnsbc.png" alt="Hospital Regional Nossa Senhora do Bom Conselho" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">CRM Portaria</h1>
            <p className="text-gray-500 font-medium text-xs mb-3">Hospital Regional Nossa Senhora do Bom Conselho</p>
            {/* Renderização dinâmica do Setor */}
            <div className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${setorConfig.cor}`}>
              {setorConfig.nome}
            </div>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r text-sm font-medium animate-in fade-in">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="email">E-mail Institucional</label>
              <input 
                {...register('email')}
                type="email" 
                placeholder="recepcao@hnsbc.com.br"
                className={`w-full p-4 rounded-xl border-2 bg-white outline-none ${errors.email ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'}`}
              />
              {errors.email && <p className="text-red-500 text-xs font-bold mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="password">Senha</label>
              <input 
                {...register('password')}
                type="password" 
                placeholder="••••••••"
                className={`w-full p-4 rounded-xl border-2 bg-white outline-none ${errors.password ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'}`}
              />
              {errors.password && <p className="text-red-500 text-xs font-bold mt-1">{errors.password.message}</p>}
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-blue hover:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex justify-center items-center disabled:opacity-70"
              >
                {isSubmitting ? "Autenticando..." : "Acessar Sistema"}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center space-y-3">
            <a href="/cadastrar" className="text-sm font-bold text-primary-green hover:text-green-700 hover:underline transition-colors block">
              Não tem conta? Cadastrar Novo Usuário (Gmail ou Institucional)
            </a>
            <a href="/recuperar" className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline transition-colors block">
              Esqueceu a senha? Solicitar recuperação
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500 font-medium">Carregando portal do setor...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
