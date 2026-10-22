"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { traduzirErroAuth } from '../../../lib/authErrors';

// Strict Zod Schema conforme exigido
const passwordSchema = z.object({
  password: z.string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula.')
    .regex(/[0-9]/, 'Deve conter pelo menos um número.')
    .regex(/[^A-Za-z0-9]/, 'Deve conter pelo menos um caractere especial.'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function NovaSenhaPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // O token do link chega na URL e é processado de forma assíncrona pelo Supabase.
  // Aguardamos o evento PASSWORD_RECOVERY/SIGNED_IN antes de considerar o link inválido.
  useEffect(() => {
    let validado = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        validado = true;
        setErrorMsg('');
      }
    });

    // Erro explícito vindo no link (ex.: link expirado)
    const hash = new URLSearchParams(window.location.hash.replace('#', ''));
    const erroLink = hash.get('error_description') || new URLSearchParams(window.location.search).get('error_description');

    // setState fora do corpo síncrono do efeito (regra react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      if (erroLink) {
        setErrorMsg('O link de acesso expirou ou já foi utilizado. Solicite um novo link.');
        return;
      }
      if (validado) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('O link de recuperação é inválido ou expirou. Solicite um novo link.');
      }
    }, erroLink ? 0 : 2500);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    mode: 'onSubmit',
  });

  const onSubmit = async (data: PasswordForm) => {
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({
      password: data.password
    });

    if (error) {
      setErrorMsg(traduzirErroAuth(error.message));
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        router.replace('/');
      }, 2500);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Definir Nova Senha</h1>
          <p className="text-gray-500 text-sm">Crie uma credencial forte para o seu acesso institucional.</p>
        </div>

        {isSuccess ? (
          <div className="text-center animate-in zoom-in">
            <h3 className="text-xl font-bold text-primary-green mb-2">Senha Definida!</h3>
            <p className="text-gray-600">Redirecionando para o sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errorMsg && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
                {errorMsg}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nova Senha</label>
              <input 
                {...register('password')}
                type="password" 
                placeholder="Ex: Hnsbc@2026"
                className={`w-full p-4 rounded-xl border-2 bg-gray-50 focus:bg-white outline-none transition-all ${errors.password ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'}`}
              />
              {errors.password && <p className="text-red-500 text-xs font-bold mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirmar Nova Senha</label>
              <input 
                {...register('confirmPassword')}
                type="password" 
                placeholder="Repita a senha"
                className={`w-full p-4 rounded-xl border-2 bg-gray-50 focus:bg-white outline-none transition-all ${errors.confirmPassword ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'}`}
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs font-bold mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-blue hover:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 mt-4"
            >
              {isSubmitting ? "Salvando..." : "Atualizar Senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
