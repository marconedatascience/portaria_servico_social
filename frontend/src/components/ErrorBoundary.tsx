"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Setor ErrorBoundary capturou erro:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border-2 border-red-200 rounded-3xl text-center shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">
            {this.props.fallbackTitle || "Erro no Carregamento do Módulo"}
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            {this.state.error?.message || "Ocorreu uma inconsistência temporária ao processar as informações deste setor."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
