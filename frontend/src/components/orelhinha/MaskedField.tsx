"use client";

import React, { useRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import {
  aplicarMascara,
  maskCartaoSus,
  maskData,
  maskHora,
  maskTelefone,
  type Mascara,
} from "../../lib/masks";

export type TipoCampoMascara = "cartao_sus" | "data" | "hora" | "telefone" | "texto";

const MASCARAS: Record<Exclude<TipoCampoMascara, "texto">, Mascara> = {
  cartao_sus: maskCartaoSus,
  data: maskData,
  hora: maskHora,
  telefone: maskTelefone,
};

const PLACEHOLDERS: Record<TipoCampoMascara, string> = {
  cartao_sus: "000.0000.0000.0000",
  data: "DD/MM/AAAA",
  hora: "HH:mm",
  telefone: "(00) 90000-0000",
  texto: "",
};

export interface MaskedFieldProps {
  id?: string;
  label: string;
  tipo?: TipoCampoMascara;
  value: string;
  onChange: (valorFormatado: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  helperText?: string;
}

export const MaskedField: React.FC<MaskedFieldProps> = ({
  id,
  label,
  tipo = "texto",
  value,
  onChange,
  onBlur,
  onKeyDown,
  error,
  disabled = false,
  readOnly = false,
  placeholder,
  autoFocus = false,
  className = "",
  helperText,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const inputRef = useRef<HTMLInputElement>(null);

  const mascara = tipo !== "texto" ? MASCARAS[tipo] : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bruto = e.target.value;
    const input = inputRef.current;
    const cursorAntes = input?.selectionStart ?? bruto.length;

    if (!mascara) {
      onChange(bruto);
      return;
    }

    const res = aplicarMascara(mascara, bruto, cursorAntes, value);
    onChange(res.valor);

    // Reposiciona o cursor no próximo render frame
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(res.cursor, res.cursor);
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!mascara) return;
    e.preventDefault();
    const textoColado = e.clipboardData.getData("text");
    const res = aplicarMascara(mascara, textoColado, textoColado.length);
    onChange(res.valor);
  };

  const isNumeric = tipo !== "texto";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-slate-700 select-none flex items-center justify-between"
      >
        <span>{label}</span>
        {readOnly && (
          <span className="text-[11px] font-normal text-slate-400 uppercase tracking-wider">
            Somente Leitura
          </span>
        )}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode={isNumeric ? "numeric" : "text"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          placeholder={placeholder ?? PLACEHOLDERS[tipo]}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-readonly={readOnly}
          className={`
            w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-[14px] text-slate-900 bg-white
            border transition-colors duration-150 outline-none
            placeholder:text-slate-400
            ${readOnly ? "bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed" : ""}
            ${
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                : !readOnly
                ? "border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                : ""
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        />
      </div>

      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-[12px] text-rose-600 font-medium mt-0.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[12px] text-slate-500 mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
