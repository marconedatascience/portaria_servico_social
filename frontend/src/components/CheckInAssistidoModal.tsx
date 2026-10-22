"use client";

import React, { useState } from 'react';
import { emitirCredencialVisitante, trocarAcompanhanteRPC, RespostaCredencial } from '../services/api';
import { UserCheck, ArrowLeftRight, Baby, Users, CheckCircle2, QrCode, Copy, Check, AlertCircle, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

interface CheckInAssistidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteNome?: string;
  leito?: string;
  pacienteId?: number;
  tipoInicial?: 'visitante' | 'acompanhante' | 'orelhinha' | 'obito';
}

export default function CheckInAssistidoModal({
  isOpen,
  onClose,
  pacienteNome,
  leito,
  pacienteId,
  tipoInicial
}: CheckInAssistidoModalProps) {
  const [step, setStep] = useState(tipoInicial ? 2 : 1);
  const [tipo, setTipo] = useState<'visitante' | 'acompanhante' | 'orelhinha' | 'obito' | null>(tipoInicial || null);
  const [inputValue, setInputValue] = useState("");
  const [docValue, setDocValue] = useState("");
  const [foneValue, setFoneValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState("");
  const [credencialGerada, setCredencialGerada] = useState<RespostaCredencial | null>(null);
  const [copiado, setCopiado] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(1);
      setTipo(null);
      setInputValue("");
      setDocValue("");
      setFoneValue("");
      setErro("");
      setCredencialGerada(null);
      setCopiado(false);
      onClose();
    }
  };

  const copiarPayload = () => {
    if (credencialGerada?.qr_payload) {
      navigator.clipboard.writeText(credencialGerada.qr_payload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const confirmar = async () => {
    const valor = inputValue.trim();
    setErro("");

    if (!pacienteId) {
      setErro("Nenhum paciente selecionado.");
      return;
    }

    if (tipo === 'obito') {
      const qtd = Number(valor);
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 50) {
        setErro("Informe uma quantidade válida entre 1 e 50 familiares.");
        return;
      }
    } else if (valor.length < 2 || valor.length > 120) {
      setErro("O nome deve ter entre 2 e 120 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (tipo === 'visitante') {
        const res = await emitirCredencialVisitante(pacienteId, valor, docValue.trim(), foneValue.trim());
        setCredencialGerada(res);
      } else if (tipo === 'acompanhante') {
        const res = await trocarAcompanhanteRPC(pacienteId, valor, docValue.trim(), foneValue.trim());
        setCredencialGerada(res);
      } else {
        // Fluxo auxiliar para orelhinha / óbito
        const res = await emitirCredencialVisitante(
          pacienteId,
          tipo === 'obito' ? `Óbito: ${valor} familiar(es)` : `Orelhinha: ${valor}`,
          docValue.trim()
        );
        setCredencialGerada(res);
      }
      setInputValue("");
      setDocValue("");
      setFoneValue("");
      setStep(3);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao emitir credencial. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-white rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header do Modal */}
        <div className="bg-gradient-to-r from-primary-blue to-blue-800 p-6 text-white">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-blue-200" />
              Check-in de Acesso & Emissão de QR Code
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm">
              Paciente: <strong className="text-white font-semibold">{pacienteNome ?? "—"}{leito ? ` (${leito})` : ""}</strong>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Corpo do Modal */}
        <div className="p-8 bg-slate-50 min-h-[380px] flex flex-col justify-center">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-xl font-bold text-center text-gray-800 mb-6">
                Selecione o tipo de liberação de acesso:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <button 
                  onClick={() => { setTipo('visitante'); setStep(2); }}
                  className="bg-white border-2 border-slate-200 hover:border-primary-green hover:bg-green-50/50 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] shadow-xs cursor-pointer text-center"
                >
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-primary-green">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-gray-800 block">Liberar Visitante</span>
                    <span className="text-xs text-gray-500 font-medium">Controle anti-revezamento e cotas diárias</span>
                  </div>
                </button>

                <button 
                  onClick={() => { setTipo('acompanhante'); setStep(2); }}
                  className="bg-white border-2 border-slate-200 hover:border-primary-blue hover:bg-blue-50/50 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] shadow-xs cursor-pointer text-center"
                >
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-primary-blue">
                    <ArrowLeftRight className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-gray-800 block">Trocar Acompanhante</span>
                    <span className="text-xs text-gray-500 font-medium">07:30–08:30 ou 18:30–19:30</span>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => { setTipo('orelhinha'); setStep(2); }}
                  className="bg-white border-2 border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.02] shadow-xs cursor-pointer text-left"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                    <Baby className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-800 block">Teste da Orelhinha</span>
                    <span className="text-xs text-gray-500">Exige [x] Caderneta e [x] Registro</span>
                  </div>
                </button>

                <button 
                  onClick={() => { setTipo('obito'); setStep(2); }}
                  className="bg-white border-2 border-slate-200 hover:border-slate-800 hover:bg-slate-100 rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.02] shadow-xs cursor-pointer text-left"
                >
                  <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-800 block">Liberação Humanizada (Óbito)</span>
                    <span className="text-xs text-gray-500">Múltiplos familiares autorizados</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
              <h3 className="text-xl font-bold text-primary-blue mb-4">
                {tipo === 'visitante' ? 'Cadastrar Visitante e Emitir Acesso' : 
                 tipo === 'acompanhante' ? 'Registrar Troca de Acompanhante' : 
                 tipo === 'obito' ? 'Registrar Quantidade de Familiares' :
                 'Nome do Responsável pelo Recém-Nascido'}
              </h3>

              {tipo === 'visitante' && (
                <div className="bg-blue-50 border-l-4 border-primary-blue p-3.5 rounded-r-xl text-xs text-blue-900 mb-4 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary-blue shrink-0" />
                  <span>
                    <strong>Anti-revezamento ativo:</strong> Máximo de 2 visitantes/dia para enfermarias e 1/dia para Área Vermelha.
                  </span>
                </div>
              )}

              {tipo === 'acompanhante' && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 rounded-r-xl text-xs text-amber-900 mb-4 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Horários oficiais para troca:</strong> Das 07h30 às 08h30 ou das 18h30 às 19h30.
                  </span>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {tipo === 'obito' ? 'Quantidade de Familiares *' : 'Nome Completo *'}
                  </label>
                  {tipo === 'obito' ? (
                    <input 
                      type="number" 
                      min="1"
                      max="50"
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ex: 3"
                      className="w-full text-xl p-3.5 rounded-xl border border-slate-300 focus:border-primary-blue focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-2xs bg-white"
                    />
                  ) : (
                    <input 
                      type="text" 
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Ex: Maria José da Silva"
                      className="w-full text-base font-semibold p-3.5 rounded-xl border border-slate-300 focus:border-primary-blue focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-2xs bg-white"
                    />
                  )}
                </div>

                {tipo !== 'obito' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Documento (CPF / RG)
                      </label>
                      <input 
                        type="text"
                        value={docValue}
                        onChange={(e) => setDocValue(e.target.value)}
                        placeholder="Ex: 123.456.789-00"
                        className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:border-primary-blue focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-2xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Telefone de Contato (Opcional)
                      </label>
                      <input 
                        type="text"
                        value={foneValue}
                        onChange={(e) => setFoneValue(e.target.value)}
                        placeholder="Ex: (82) 99999-0000"
                        className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:border-primary-blue focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-2xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {erro && (
                <div role="alert" className="mb-4 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl text-sm font-medium">
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => { setErro(""); setStep(1); }}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button 
                  disabled={isSubmitting || !inputValue.trim() || !pacienteId}
                  onClick={confirmar}
                  className="flex-[2] py-3 text-sm font-bold text-white bg-primary-green hover:bg-green-600 rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Emitindo Credencial..." : "Confirmar & Emitir QR Code"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in zoom-in duration-300 flex flex-col items-center justify-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-primary-green mb-3">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Acesso Liberado com Sucesso!</h3>
              <p className="text-sm text-gray-600 text-center mb-5">
                {credencialGerada?.mensagem || "Credencial emitida e registrada no sistema."}
              </p>

              {/* Bloco de Exibição do QR Code Payload Cego (HNSBC|TokenUUID) */}
              {credencialGerada?.qr_payload && (
                <div className="w-full max-w-md bg-white border-2 border-slate-200 rounded-2xl p-5 mb-5 shadow-sm text-center">
                  <div className="flex items-center justify-center gap-2 text-primary-blue font-bold text-sm mb-3">
                    <QrCode className="w-5 h-5 text-primary-blue" />
                    <span>Credencial Digital (Payload Cego)</span>
                  </div>

                  {/* Renderização Visual do QR Code */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                      <QRCodeSVG
                        value={credencialGerada.qr_payload}
                        size={170}
                        level="H"
                        includeMargin={false}
                        fgColor="#0f172a"
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-2 font-medium">
                      Apresente na catraca / leitor da portaria
                    </span>
                  </div>

                  {/* Detalhes da Liberação */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-left text-xs text-slate-700 mb-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paciente:</span>
                      <span className="font-bold text-gray-900">{pacienteNome || "Paciente"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Leito:</span>
                      <span className="font-bold text-primary-blue">{leito || "Leito"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tipo de Acesso:</span>
                      <span className="font-bold uppercase text-gray-800">{tipo}</span>
                    </div>
                    {credencialGerada.placar && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Placar de Cotas Hoje:</span>
                        <span className="font-bold text-primary-green">{credencialGerada.placar}</span>
                      </div>
                    )}
                  </div>

                  {/* Payload Cego em Texto */}
                  <div className="font-mono text-xs bg-slate-100 p-2.5 rounded-xl border border-slate-200 select-all break-all text-slate-700 mb-3">
                    {credencialGerada.qr_payload}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center justify-center gap-1.5 flex-1 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      Imprimir Crachá
                    </button>
                    <button
                      type="button"
                      onClick={copiarPayload}
                      className="inline-flex items-center justify-center gap-1.5 flex-1 font-bold text-primary-blue hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      {copiado ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-green-700">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Payload
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => handleOpenChange(false)}
                className="px-8 py-3.5 text-base font-bold text-white bg-primary-blue hover:bg-blue-700 rounded-xl shadow-lg transition-transform active:scale-95 w-full cursor-pointer"
              >
                Concluir e Voltar ao Painel
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
