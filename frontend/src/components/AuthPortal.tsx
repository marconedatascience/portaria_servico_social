"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { traduzirErroAuth } from "../lib/authErrors";
import { perfilDaSessao, rotaInicialDoPerfil } from "../lib/perfil";
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Lock, 
  Mail, 
  Building2, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  UserPlus, 
  LogIn, 
  AlertCircle 
} from "lucide-react";

const NOMES_SETORES: Record<string, { nome: string; cor: string }> = {
  portaria: { nome: "Controle de Acesso - Portaria", cor: "bg-blue-50 text-blue-800 border-blue-200" },
  fono: { nome: "Fonoaudiologia - Teste da Orelhinha", cor: "bg-purple-50 text-purple-800 border-purple-200" },
  servico_social: { nome: "Serviço Social - Acolhimento Humanizado", cor: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

function AuthPortalContent({ defaultTab = "login" }: { defaultTab?: "login" | "cadastro" }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const setorParam = searchParams.get("setor")?.toLowerCase() || "";

  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<"login" | "cadastro">(
    defaultTab === "cadastro" || tabParam === "cadastro" ? "cadastro" : "login"
  );

  // Estados do formulário de Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Estados do formulário de Cadastro
  const [cadEmail, setCadEmail] = useState("");
  const [cadSetor, setCadSetor] = useState<"portaria" | "servico_social" | "fono">(
    (setorParam as "portaria" | "servico_social" | "fono") || "portaria"
  );
  const [cadPassword, setCadPassword] = useState("");
  const [cadConfirmPassword, setCadConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [cadastroSucesso, setCadastroSucesso] = useState(false);
  const [cadastroMsg, setCadastroMsg] = useState("");

  // Visibilidade de senhas e mensagens
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (tabParam === "cadastro") {
      setActiveTab("cadastro");
    } else if (tabParam === "login") {
      setActiveTab("login");
    }

    // Limpa credenciais acidentalmente expostas na URL se houve GET submit prévio
    if (typeof window !== "undefined" && (window.location.search.includes("password") || window.location.search.includes("email"))) {
      const qEmail = searchParams.get("email");
      if (qEmail) {
        setLoginEmail(qEmail);
        setCadEmail(qEmail);
      }
      const cleanUrl = tabParam === "cadastro" ? "/login?tab=cadastro" : "/login";
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [tabParam, searchParams]);

  const setorConfig = NOMES_SETORES[setorParam] || {
    nome: "Sistema Integrado de Acesso Hospitalar",
    cor: "bg-slate-100 text-slate-700 border-slate-200",
  };

  // 1. Ação de Login Direta e Segura
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAuthError("");

    const emailTrim = loginEmail.trim().toLowerCase();
    const passwordTrim = loginPassword;

    if (!emailTrim) {
      setAuthError("Por favor, informe seu e-mail institucional.");
      return;
    }
    if (!passwordTrim) {
      setAuthError("Por favor, informe sua senha de acesso.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: passwordTrim,
      });

      if (error) {
        setAuthError(traduzirErroAuth(error.message));
        setIsLoggingIn(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("e2e_session");
      }

      if (data?.session) {
        const perfil = perfilDaSessao(data.session);
        const rotaDestino = perfil ? rotaInicialDoPerfil(perfil) : "/";
        window.location.replace(rotaDestino);
      } else {
        window.location.replace("/");
      }
    } catch (err: unknown) {
      console.error("Erro no login:", err);
      setAuthError(err instanceof Error ? err.message : "Erro inesperado ao conectar.");
      setIsLoggingIn(false);
    }
  };

  // 2. Ação de Cadastro Direta e Segura com UX melhorada e tratamento de erro de rede
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAuthError("");

    const emailTrim = cadEmail.trim().toLowerCase();
    if (!emailTrim || !emailTrim.includes("@")) {
      setAuthError("Por favor, informe um endereço de e-mail válido.");
      return;
    }
    if (!cadPassword || cadPassword.length < 8) {
      setAuthError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (cadPassword !== cadConfirmPassword) {
      setAuthError("As senhas digitadas não coincidem.");
      return;
    }

    setIsRegistering(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const endpoint = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/api/v1/auth/cadastrar`
        : "/api/auth/cadastrar";

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailTrim,
            password: cadPassword,
            setor: cadSetor,
          }),
        });
      } catch (networkError) {
        // Fallback para a rota interna Next.js caso o backend direto apresente falha de conexão
        if (baseUrl && endpoint !== "/api/auth/cadastrar") {
          try {
            response = await fetch("/api/auth/cadastrar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: emailTrim,
                password: cadPassword,
                setor: cadSetor,
              }),
            });
          } catch {
            throw new Error("Falha de comunicação com o servidor. Verifique se o serviço está ativo.");
          }
        } else {
          throw new Error("Falha de comunicação com o servidor. Verifique se o serviço está ativo.");
        }
      }

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        // Resposta sem corpo JSON legível
      }

      if (!response.ok) {
        const errorMsg = result?.detail || result?.error || result?.message || "Falha ao solicitar criação da conta.";
        if (
          typeof errorMsg === "string" &&
          (errorMsg.toLowerCase().includes("fetch failed") || errorMsg.toLowerCase().includes("failed to fetch"))
        ) {
          throw new Error("Falha de comunicação com o servidor. Verifique se o serviço está ativo.");
        }
        throw new Error(errorMsg);
      }

      setCadastroMsg(result?.message || "Conta criada com sucesso! Você já pode fazer login.");
      setCadastroSucesso(true);
      setIsRegistering(false);
    } catch (err: unknown) {
      console.error("Erro no cadastro:", err);
      let mensagemAmigavel = "Erro inesperado ao cadastrar.";
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (
          msg.includes("fetch failed") ||
          msg.includes("failed to fetch") ||
          msg.includes("networkerror") ||
          msg.includes("connection refused") ||
          msg.includes("econnrefused") ||
          msg.includes("falha de comunicação com o servidor")
        ) {
          mensagemAmigavel = "Falha de comunicação com o servidor. Verifique se o serviço está ativo.";
        } else {
          mensagemAmigavel = err.message;
        }
      }
      setAuthError(mensagemAmigavel);
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-900 font-sans">
      {/* ======================================================== */}
      {/* LADO ESQUERDO: FOTO DE RECEPÇÃO MODERNA COM GRADIENTE    */}
      {/* ======================================================== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-7/12 flex-col justify-between p-12 xl:p-16 overflow-hidden">
        {/* Foto de Fundo da Recepção do Hospital */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ backgroundImage: "url('/hospital_reception.jpg')" }}
        />

        {/* Gradiente Overlay: Azul Marinho Profundo (#041633) + Verde Teal (#0B5351) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#041633]/95 via-[#072d5c]/85 to-[#0b5351]/80 backdrop-blur-[0.5px]" />

        {/* Topo do Lado Esquerdo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wide uppercase">
              Portal HNSBC • Sistema Online
            </span>
          </div>

          <div className="text-white/70 text-xs font-medium flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-xl border border-white/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Acesso Criptografado & RLS
          </div>
        </div>

        {/* Centro do Lado Esquerdo: Mensagem de Impacto */}
        <div className="relative z-10 max-w-xl my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            Triagem Humanizada & Controle Digital
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
            Segurança hospitalar, acolhimento e agilidade no acesso.
          </h1>
          <p className="mt-5 text-base xl:text-lg text-slate-200/90 leading-relaxed font-normal">
            Plataforma unificada para controle biométrico e emissão de QR Codes para a Portaria, 
            leitos assistidos pelo Serviço Social e exames da Fonoaudiologia.
          </p>

          {/* Cards de Métricas e Segurança */}
          <div className="grid grid-cols-3 gap-4 mt-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl">
              <div className="text-2xl font-black text-white">100%</div>
              <div className="text-xs text-slate-300 font-medium mt-1">Digital sem Papel</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl">
              <div className="text-2xl font-black text-emerald-400">Anti-Fraude</div>
              <div className="text-xs text-slate-300 font-medium mt-1">Cotas de Visitas</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl">
              <div className="text-2xl font-black text-blue-300">LGPD</div>
              <div className="text-xs text-slate-300 font-medium mt-1">QR Code Seguro</div>
            </div>
          </div>
        </div>

        {/* Rodapé do Lado Esquerdo */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80 border-t border-white/10 pt-6">
          <span>Hospital Regional Nossa Senhora do Bom Conselho</span>
          <span>Versão 1.0.0 Oficial</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* LADO DIREITO: CARD MINIMALISTA COM GLASSMORPHISM         */}
      {/* ======================================================== */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-gradient-to-br from-slate-100 via-white to-blue-50/40">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(10,61,145,0.12)] border border-white p-7 sm:p-10 transition-all">
          
          {/* Logo e Identificação do Hospital */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-900/5 border border-slate-100 p-2 mb-3 transition-transform hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo_hnsbc.png" 
                alt="Hospital Regional Nossa Senhora do Bom Conselho" 
                className="w-full h-full object-contain" 
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeTab === "login" ? "Acessar Sistema" : "Criar Nova Conta"}
            </h2>
            <p className="text-slate-500 font-medium text-xs mt-1">
              Hospital Regional Nossa Senhora do Bom Conselho
            </p>
            {setorParam && (
              <div className={`mt-2.5 inline-block px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${setorConfig.cor}`}>
                {setorConfig.nome}
              </div>
            )}
          </div>

          {/* Switcher Minimalista de Abas: Login vs Criar Conta */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100/90 rounded-2xl mb-6 border border-slate-200/80 shadow-inner">
            <button
              id="tab-login"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("login");
                setAuthError("");
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/login");
                }
              }}
              className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "login"
                  ? "bg-[#0A3D91] text-white shadow-md font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
            <button
              id="tab-criar-conta"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("cadastro");
                setAuthError("");
                setCadastroSucesso(false);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/login?tab=cadastro");
                }
              }}
              className={`py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "cadastro"
                  ? "bg-[#0A3D91] text-white shadow-md font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Criar Conta</span>
            </button>
          </div>

          {/* Mensagem de Erro Geral com Ícone de Alerta */}
          {authError && (
            <div className="mb-5 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl text-xs sm:text-sm font-medium flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 1: FORMULÁRIO DE LOGIN                               */}
          {/* ======================================================== */}
          {activeTab === "login" && (
            <form method="POST" onSubmit={handleLogin} className="space-y-4">
              {/* Campo E-mail */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  E-mail Institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="recepcao@hnsbc.com.br"
                    required
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm outline-none transition-all shadow-xs focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  <a
                    href="/recuperar"
                    className="text-xs font-semibold text-slate-500 hover:text-[#0A3D91] transition-colors"
                  >
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-11 py-3.5 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm outline-none transition-all shadow-xs focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botão Principal de Login */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-[#0A3D91] hover:bg-[#082e6d] text-white font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(10,61,145,0.35)] hover:shadow-[0_6px_25px_rgba(10,61,145,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm sm:text-base"
                >
                  {isLoggingIn ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Conectando ao sistema...
                    </span>
                  ) : (
                    <>
                      <span>Acessar Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Botão de Alternância Direta: Não tem conta? Criar Conta */}
              <div className="pt-4 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("cadastro");
                    setAuthError("");
                    setCadastroSucesso(false);
                    if (typeof window !== "undefined") {
                      window.history.replaceState(null, "", "/login?tab=cadastro");
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Não tem conta? Criar Conta agora</span>
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* ABA 2: FORMULÁRIO DE CRIAR CONTA                         */}
          {/* ======================================================== */}
          {activeTab === "cadastro" && (
            <div>
              {cadastroSucesso ? (
                <div className="text-center py-4 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Conta Criada!</h3>
                  <p className="text-xs text-slate-600 mt-2 mb-6">
                    {cadastroMsg || "Sua conta foi criada com sucesso! Você já pode fazer login para acessar o sistema."}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab("login");
                      setCadastroSucesso(false);
                      setAuthError("");
                      if (typeof window !== "undefined") {
                        window.history.replaceState(null, "", "/login");
                      }
                    }}
                    className="w-full bg-[#0A3D91] hover:bg-[#082e6d] text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Ir para o Login</span>
                  </button>
                </div>
              ) : (
                <form method="POST" onSubmit={handleCadastro} className="space-y-3.5">
                  {/* Campo E-mail */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      E-mail Institucional ou Pessoal
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={cadEmail}
                        onChange={(e) => setCadEmail(e.target.value)}
                        placeholder="usuario@hnsbc.com.br"
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm outline-none focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Campo Setor Hospitalar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Setor Hospitalar
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        value={cadSetor}
                        onChange={(e) => setCadSetor(e.target.value as "portaria" | "servico_social" | "fono")}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm outline-none focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50 shadow-xs font-medium cursor-pointer"
                      >
                        <option value="portaria">Portaria (Controle de Acesso e Visitantes)</option>
                        <option value="servico_social">Serviço Social (Acolhimento e Leitos)</option>
                        <option value="fono">Fonoaudiologia (Teste da Orelhinha)</option>
                      </select>
                    </div>
                  </div>

                  {/* Campo Nova Senha */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Criar Senha (Mínimo 8 caracteres)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={cadPassword}
                        onChange={(e) => setCadPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                        minLength={8}
                        className="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm outline-none focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Campo Confirmar Senha */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Confirmar Senha
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={cadConfirmPassword}
                        onChange={(e) => setCadConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        required
                        className="w-full pl-10 pr-11 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm outline-none focus:border-[#0A3D91] focus:ring-4 focus:ring-blue-50 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Botão Principal: Criar Conta */}
                  <div className="pt-2">
                    <button
                      id="btn-submit-criar-conta"
                      type="submit"
                      disabled={isRegistering}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.45)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 text-sm sm:text-base"
                    >
                      {isRegistering ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Criando Conta...
                        </span>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Criar Conta</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Botão de Alternância Direta: Já possui conta? Fazer Login */}
                  <div className="pt-3 text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab("login");
                        setAuthError("");
                        if (typeof window !== "undefined") {
                          window.history.replaceState(null, "", "/login");
                        }
                      }}
                      className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Já possui conta? Fazer Login</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Rodapé de Ajuda Institucional */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              Acesso exclusivo para profissionais autorizados do Hospital Regional HNSBC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPortal({ defaultTab = "login" }: { defaultTab?: "login" | "cadastro" }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-medium">
        Carregando portal de acesso...
      </div>
    }>
      <AuthPortalContent defaultTab={defaultTab} />
    </Suspense>
  );
}
