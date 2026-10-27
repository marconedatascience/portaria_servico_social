/**
 * Utilitários de Máscaras e Validações Estritas para o Módulo Hospitalar
 * "Teste da Orelhinha" (Fonoaudiologia, Serviço Social, Portaria)
 */

/**
 * Máscara Cartão SUS: 000.0000.0000.0000 (15 dígitos)
 */
export function maskCartaoSUS(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "").slice(0, 15);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7, 11)}.${digits.slice(11, 15)}`;
}

/**
 * Validação rigorosa de Cartão SUS (15 dígitos numéricos)
 */
export function isValidSUS(val: string): boolean {
  if (!val) return false;
  const digits = val.replace(/\D/g, "");
  return digits.length === 15;
}

/**
 * Máscara de Data: DD/MM/YYYY
 */
export function maskDate(val: string): string {
  if (!val) return "";
  // Se já vier no formato YYYY-MM-DD do banco/HTML input, converte para DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }

  const digits = val.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Validação estrita de calendário para DD/MM/YYYY
 * Valida meses (1-12), dias reais do mês (ex: 30 de fevereiro é inválido) e anos bissextos.
 */
export function isValidDate(val: string): boolean {
  if (!val) return false;
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  // Dias por mês considerando ano bissexto
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  const maxDays = daysInMonth[month - 1];
  return day >= 1 && day <= maxDays;
}

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD (para compatibilidade com banco/API)
 */
export function dateToIso(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return val;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Máscara de Hora: HH:mm (00:00 a 23:59)
 */
export function maskTime(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

/**
 * Validação estrita de Hora: HH:mm (00 a 23 e 00 a 59)
 */
export function isValidTime(val: string): boolean {
  if (!val) return false;
  const match = val.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Máscara de Telefone com 9º dígito: (00) 9.0000-0000
 */
export function maskPhone(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : "";
  }
  if (digits.length <= 3) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 7) {
    // (XX) 9.XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}.${digits.slice(3)}`;
  }
  // (XX) 9.XXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}.${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Validação de telefone (mínimo DDD + 8 ou 9 dígitos = 10 ou 11 dígitos)
 */
export function isValidPhone(val: string): boolean {
  if (!val) return false;
  const digits = val.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 10;
}
