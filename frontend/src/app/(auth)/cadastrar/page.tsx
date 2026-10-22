"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { CheckCircle2, UserPlus } from 'lucide-react';

const cadastroSchema = z.object({
  email: z.string().email('Formato de e-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.').max(72, 'A senha deve ter no máximo 72 caracteres.'),
  confirmPassword: z.string(),
  setor: z.enum(['portaria', 'servico_social', 'fono']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export default function CadastrarPage() {
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      setor: 'portaria',
    },
    mode: 'onSubmit',
  });

  const onSubmit = async (data: CadastroForm) => {
    setErrorMsg('');
    try {
      const response = await fetch('/api/auth/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          setor: data.setor,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao cadastrar conta.');
      }

      setSuccessMsg(result.message || 'Conta criada com sucesso!');
      setIsSuccess(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error && err.message ? err.message : 'Erro inesperado ao cadastrar.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-slate-50 to-green-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 p-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_hnsbc.png" alt="Hospital Regional Nossa Senhora do Bom Conselho" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Criar Conta</h1>
            <p className="text-gray-500 font-medium text-sm">Use seu e-mail institucional. O acesso é liberado após aprovação da administração.</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r text-sm font-medium animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {isSuccess ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-primary-green mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Conta Pronta!</h3>
              <p className="text-gray-600 mb-6 text-sm">
                {successMsg || "Seu acesso foi registrado. Você já pode fazer login para acessar o painel do seu setor."}
              </p>
              <Link
                href="/login"
                className="inline-block text-center w-full bg-primary-blue text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-800 transition-colors"
              >
                Ir para o Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Setor Hospitalar</label>
                <select
                  {...register('setor')}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white outline-none focus:border-primary-blue focus:ring-4 focus:ring-blue-50 font-medium text-gray-800"
                >
                  <option value="portaria">Portaria (Controle de Acesso e Visitantes)</option>
                  <option value="servico_social">Serviço Social (Acolhimento e Leitos)</option>
                  <option value="fono">Fonoaudiologia (Teste da Orelhinha)</option>
                </select>
                {errors.setor && <p className="text-red-500 text-xs font-bold mt-1">{errors.setor.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu.email@hospital.com"
                  className={`w-full p-4 rounded-xl border-2 bg-white outline-none transition-all ${
                    errors.email ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'
                  }`}
                />
                {errors.email && <p className="text-red-500 text-xs font-bold mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Criar Senha</label>
                <input
                  {...register('password')}
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className={`w-full p-4 rounded-xl border-2 bg-white outline-none transition-all ${
                    errors.password ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'
                  }`}
                />
                {errors.password && <p className="text-red-500 text-xs font-bold mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar Senha</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="Repita a senha"
                  className={`w-full p-4 rounded-xl border-2 bg-white outline-none transition-all ${
                    errors.confirmPassword ? 'border-red-400 focus:ring-4 focus:ring-red-100' : 'border-gray-200 focus:border-primary-blue focus:ring-4 focus:ring-blue-50'
                  }`}
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs font-bold mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary-green hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 cursor-pointer"
                >
                  <UserPlus className="w-5 h-5" />
                  {isSubmitting ? "Criando Conta..." : "Solicitar Acesso"}
                </button>
              </div>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-bold text-primary-blue hover:text-blue-800 hover:underline transition-colors block">
                  Já possui conta? Fazer login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
