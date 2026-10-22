"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { traduzirErroAuth } from '../../../lib/authErrors';

const recuperarSchema = z.object({
  email: z.string().email('Formato de e-mail inválido.'),
});

type RecuperarForm = z.infer<typeof recuperarSchema>;

export default function RecuperarPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecuperarForm>({
    resolver: zodResolver(recuperarSchema),
    mode: 'onSubmit',
  });

  const onSubmit = async (data: RecuperarForm) => {
    try {
      setErrorMsg('');
      setIsSuccess(false);

      const { error } = await supabase.auth.resetPasswordForEmail(data.email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/nova-senha`,
      });

      if (error) {
        console.error('resetPasswordForEmail:', error);
        setErrorMsg(traduzirErroAuth(error.message));
      } else {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      console.error('resetPasswordForEmail (exceção):', err);
      setErrorMsg(traduzirErroAuth(err instanceof Error ? err.message : undefined));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-50 p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Solicitar Acesso</h1>
            <p className="text-gray-500 text-sm">Informe seu e-mail institucional para receber o link de acesso seguro.</p>
          </div>

          {isSuccess ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-primary-green mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">E-mail Enviado!</h3>
              <p className="text-gray-600 mb-6">Se o e-mail estiver registrado, você receberá um link de validação em instantes.</p>
              <a href="/login" className="inline-block text-center w-full bg-primary-blue text-white font-bold py-4 rounded-xl shadow hover:bg-blue-800 transition-colors">
                Voltar para o Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {errorMsg && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">E-mail Institucional</label>
                <input 
                  {...register('email')}
                  type="email" 
                  placeholder="recepcao@hnsbc.com.br"
                  className={`w-full p-4 rounded-xl border-2 bg-gray-50 focus:bg-white outline-none transition-all ${errors.email ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'}`}
                />
                {errors.email && <p className="text-red-500 text-xs font-bold mt-1">{errors.email.message}</p>}
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-green hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex justify-center disabled:opacity-70"
              >
                {isSubmitting ? "Processando..." : "Enviar Link de Acesso"}
              </button>
              
              <div className="text-center mt-6">
                <a href="/login" className="text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors block">
                  ← Voltar para o Login
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
