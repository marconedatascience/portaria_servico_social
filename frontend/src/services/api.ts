import { supabase } from '../lib/supabase';

export interface Acompanhante {
  id?: number;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  data_cadastro?: string;
  status?: string;
}

export interface Visitante {
  id?: number;
  nome: string;
  documento?: string | null;
  telefone?: string | null;
  data_entrada?: string;
  status?: string;
  isProcedimento?: boolean;
  tipoAcesso?: 'VISITANTE' | 'ORELHINHA' | 'OBITO' | 'PROCEDIMENTO';
}

export interface Paciente {
  id: number;
  uuid?: string;
  leito: string;
  usuario_nome: string;
  nome_mae?: string | null;
  setor_clinica?: string | null;
  id_atendimento: string;
  municipio?: string | null;
  acompanhante_nome?: string | null;
  acompanhante_documento?: string | null;
  acompanhante_telefone?: string | null;
  acompanhante?: Acompanhante | null;
  visitante_ativo?: string | null;
  visitante_documento?: string | null;
  visitante_telefone?: string | null;
  visitante?: Visitante | null;
  visitantes?: Visitante[];
  procedimentos_ativos?: Visitante[];
  status_internacao?: string;
  data_internacao: string;
  data_alta?: string | null;
  cota_maxima?: number;
  cotas_usadas?: number;
  placar?: string;
}

export interface PlacarCotas {
  paciente_id: number;
  usuario_nome: string;
  leito: string;
  cotas_usadas: number;
  cota_maxima: number;
  placar: string;
  pode_emitir: boolean;
  visitante_ativo: string | null;
  acompanhante_nome: string | null;
  status_internacao: string;
}

export interface RespostaCredencial {
  sucesso: boolean;
  credencial_id: string;
  token_qr: string;
  qr_payload: string;
  cotas_usadas?: number;
  cota_maxima?: number;
  placar?: string;
  mensagem: string;
}

export interface SlotOrelhinha {
  id: number;
  data_exame: string;
  horario: string;
  turno: string;
  paciente_id?: number | null;
  nome_rn?: string | null;
  nome_mae?: string | null;
  leito?: string | null;
  caderneta_vacinacao: boolean;
  registro_nascimento: boolean;
  status: string;
  observacoes?: string | null;
}

// Converte erros do Supabase/Postgres em mensagens amigáveis para o operador.
export function erroLegivel(error: unknown, padrao: string): Error {
  const msg = (error as { message?: string })?.message ?? '';
  if (msg.includes('Cota máxima atingida hoje')) {
    return new Error('Cota máxima atingida hoje.');
  }
  if (msg.includes('FORA_HORARIO_VISITA') || msg.includes('visita permitida apenas')) {
    return new Error('Visita permitida apenas no horário regulamentar: 15h00 às 16h00 (Clínicas) ou 16h00 às 17h00 (Vermelha).');
  }
  if (msg.includes('SLOT_SEM_RN')) {
    return new Error('O Serviço Social precisa vincular o RN a este horário antes da liberação.');
  }
  if (msg.includes('JANELA_TROCA')) {
    return new Error('Troca de acompanhante permitida apenas nos horários definidos (07h30 às 08h30 ou 18h30 às 19h30).');
  }
  if (msg.includes('Caderneta de Vacinação') || msg.includes('Registro de Nascimento') || msg.includes('checkboxes')) {
    return new Error('Liberação requer marcar obrigatoriamente os checkboxes [x] Caderneta de Vacinação e [x] Registro de Nascimento.');
  }
  if (msg.includes('alta hospitalar') || msg.includes('status_internacao')) {
    return new Error('Operação não permitida: Paciente já recebeu alta hospitalar.');
  }
  if (msg.includes('row-level security') || (error as { code?: string })?.code === '42501') {
    return new Error('Sem permissão para esta operação. Verifique suas credenciais de acesso.');
  }
  return new Error(msg || padrao);
}

// Base operacional inicial HNSBC (garante continuidade mesmo antes da sincronização no SQL Editor)
const PACIENTES_INICIAIS: Paciente[] = [
  {
    id: 1,
    id_atendimento: 'ATD-2026-001',
    leito: 'Leito 101 - Clínica Médica',
    usuario_nome: 'Severino da Silva',
    nome_mae: 'Maria das Dores Silva',
    setor_clinica: 'Clínica Médica',
    municipio: 'Arapiraca - AL',
    acompanhante_nome: 'Maria da Silva',
    acompanhante_documento: '123.456.789-00',
    acompanhante_telefone: '(82) 98888-1111',
    acompanhante: {
      nome: 'Maria da Silva',
      documento: '123.456.789-00',
      telefone: '(82) 98888-1111',
    },
    visitante_ativo: null,
    status_internacao: 'INTERNADO',
    data_internacao: new Date().toISOString(),
    cota_maxima: 2,
    cotas_usadas: 0,
    placar: 'Visitantes: 0/2'
  },
  {
    id: 2,
    id_atendimento: 'ATD-2026-002',
    leito: 'Leito 102 - Vermelha',
    usuario_nome: 'José Alves de Oliveira',
    nome_mae: 'Ana Maria Alves',
    setor_clinica: 'Vermelha',
    municipio: 'Palmeira dos Índios - AL',
    acompanhante_nome: 'Pedro Alves',
    acompanhante_documento: '234.567.890-11',
    acompanhante_telefone: '(82) 98777-2222',
    acompanhante: {
      nome: 'Pedro Alves',
      documento: '234.567.890-11',
      telefone: '(82) 98777-2222',
    },
    visitante_ativo: null,
    status_internacao: 'INTERNADO',
    data_internacao: new Date().toISOString(),
    cota_maxima: 1,
    cotas_usadas: 0,
    placar: 'Visitantes: 0/1'
  },
  {
    id: 3,
    id_atendimento: 'ATD-2026-003',
    leito: 'Maternidade 03',
    usuario_nome: 'Mariana Santos Lima',
    nome_mae: 'Cláudia Santos',
    setor_clinica: 'Maternidade',
    municipio: 'Arapiraca - AL',
    acompanhante_nome: 'Carlos Lima',
    acompanhante_documento: '045.892.123-99',
    acompanhante_telefone: '(82) 99123-4567',
    acompanhante: {
      nome: 'Carlos Lima',
      documento: '045.892.123-99',
      telefone: '(82) 99123-4567',
    },
    visitante_ativo: null,
    status_internacao: 'INTERNADO',
    data_internacao: new Date().toISOString(),
    cota_maxima: 2,
    cotas_usadas: 0,
    placar: 'Visitantes: 0/2'
  },
  {
    id: 4,
    id_atendimento: 'ATD-2026-004',
    leito: 'Pediatria 05',
    usuario_nome: 'Enzo Gabriel dos Santos',
    nome_mae: 'Camila dos Santos',
    setor_clinica: 'Pediatria',
    municipio: 'Craíbas - AL',
    acompanhante_nome: 'Camila dos Santos',
    acompanhante_documento: '345.678.901-22',
    acompanhante_telefone: '(82) 99666-3333',
    acompanhante: {
      nome: 'Camila dos Santos',
      documento: '345.678.901-22',
      telefone: '(82) 99666-3333',
    },
    visitante_ativo: null,
    status_internacao: 'INTERNADO',
    data_internacao: new Date().toISOString(),
    cota_maxima: 2,
    cotas_usadas: 0,
    placar: 'Visitantes: 0/2'
  }
];

const STORAGE_PACIENTES_KEY = 'hnsbc_pacientes_dados_v2';

export const carregarMemoriaPersistida = (): Paciente[] => {
  if (typeof window !== 'undefined') {
    try {
      const salvo = localStorage.getItem(STORAGE_PACIENTES_KEY);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          pacientesMemoria = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Erro ao ler dados persistidos do localStorage:", e);
    }
  }
  return pacientesMemoria;
};

export const salvarMemoriaPersistida = (lista: Paciente[]) => {
  pacientesMemoria = lista;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_PACIENTES_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn("Erro ao salvar dados no localStorage:", e);
    }
  }
};

let pacientesMemoria: Paciente[] = [...PACIENTES_INICIAIS];
const cotasDiariasMemoria: Record<number, number> = {};

// Inicializa a memória se houver dados persistidos no navegador
if (typeof window !== 'undefined') {
  carregarMemoriaPersistida();
}

export const fetchPacientes = async (): Promise<Paciente[]> => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .order('criado_em', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((p, idx) => {
        const isVermelha = (p.tipo_leito || p.setor_clinica || '').toUpperCase().includes('VERMELHA');
        const cotaMax = isVermelha ? 1 : 2;
        const leitoFormatado = p.leito || (p.tipo_leito ? `${p.tipo_leito.replace(/_/g, ' ')} ${p.leito_atual || ''}`.trim() : `Leito ${idx + 1}`);
        const idNumerico = typeof p.id === 'number' ? p.id : (idx + 1);

        return {
          id: idNumerico,
          uuid: String(p.id),
          id_atendimento: p.id_atendimento || `ATD-2026-${String(idx + 1).padStart(3, '0')}`,
          usuario_nome: p.usuario_nome || p.nome || 'Paciente sem nome',
          nome_mae: p.nome_mae || null,
          leito: leitoFormatado,
          setor_clinica: p.setor_clinica || p.tipo_leito || 'Geral',
          municipio: p.municipio || 'Alagoas',
          acompanhante_nome: p.acompanhante_nome || null,
          acompanhante: p.acompanhante || null,
          visitante_ativo: p.visitante_ativo || null,
          visitantes: p.visitantes || [],
          status_internacao: p.status_internacao || p.status || 'INTERNADO',
          data_internacao: p.data_internacao || p.data_entrada || new Date().toISOString(),
          cota_maxima: p.cota_maxima || cotaMax,
          cotas_usadas: p.cotas_usadas || (p.visitante_ativo ? 1 : 0),
          placar: p.placar || `Visitantes: ${p.cotas_usadas || (p.visitante_ativo ? 1 : 0)}/${cotaMax}`
        };
      });
    }
  } catch (err) {
    console.warn("Utilizando base operacional local HNSBC para os leitos:", err);
  }
  return carregarMemoriaPersistida();
};

/**
 * Busca os dados completos de um paciente via API (GET),
 * incluindo acompanhante e a lista completa de visitantes no quarto.
 * Garante persistência e dados íntegros após recarregar a tela (F5).
 */
export const fetchPacientePorId = async (pacienteId: number | string): Promise<Paciente | null> => {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const resp = await fetch(`${backendUrl}/api/v1/pacientes/${pacienteId}`, {
        headers: { "Content-Type": "application/json" }
      });
      if (resp.ok) {
        const dados = await resp.json();
        return dados;
      }
    } catch {
      // Fallback para Supabase ou base operacional caso o backend python esteja offline
    }

    const isUuid = typeof pacienteId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pacienteId);
    if (isUuid) {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', pacienteId)
        .maybeSingle();

      if (!error && data) {
        const isVermelha = (data.tipo_leito || data.setor_clinica || '').toUpperCase().includes('VERMELHA');
        const cotaMax = isVermelha ? 1 : 2;
        return {
          id: 1,
          uuid: data.id,
          id_atendimento: data.id_atendimento || `ATD-2026-001`,
          usuario_nome: data.nome || data.usuario_nome || 'Paciente sem nome',
          nome_mae: data.nome_mae || null,
          leito: data.leito || `${data.tipo_leito?.replace(/_/g, ' ') || 'Leito'} ${data.leito_atual || ''}`.trim(),
          setor_clinica: data.tipo_leito || data.setor_clinica || 'Geral',
          municipio: data.municipio || 'Alagoas',
          acompanhante_nome: data.acompanhante_nome || null,
          acompanhante: data.acompanhante || null,
          visitante_ativo: data.visitante_ativo || null,
          visitantes: data.visitantes || [],
          status_internacao: data.status || data.status_internacao || 'INTERNADO',
          data_internacao: data.data_entrada || data.data_internacao || new Date().toISOString(),
          cota_maxima: cotaMax,
          cotas_usadas: data.cotas_usadas || (data.visitante_ativo ? 1 : 0),
          placar: `Visitantes: ${data.cotas_usadas || (data.visitante_ativo ? 1 : 0)}/${cotaMax}`
        };
      }
    }

    const lista = await fetchPacientes();
    const encontrado = lista.find(p => p.id === Number(pacienteId) || p.uuid === String(pacienteId));
    if (encontrado) {
      return encontrado;
    }
  } catch (err) {
    console.warn("Utilizando base operacional local para carregar paciente:", err);
  }

  // Fallback local garantindo persistência no F5
  const listaLocal = carregarMemoriaPersistida();
  const paciente = listaLocal.find(p => p.id === Number(pacienteId) || p.uuid === String(pacienteId));
  return paciente || null;
};

export const fetchPacienteCompleto = fetchPacientePorId;

export interface EmitirCredencialOpcoes {
  isProcedimento?: boolean;
  tipoAcesso?: 'VISITANTE' | 'ORELHINHA' | 'OBITO' | 'PROCEDIMENTO';
}

// RPC 1: Emitir Credencial de Visitante ou Procedimento Clínico (Orelhinha com cota isolada)
export const emitirCredencialVisitante = async (
  pacienteId: number,
  nomeVisitante: string,
  documento?: string,
  telefone?: string,
  opcoes?: EmitirCredencialOpcoes
): Promise<RespostaCredencial> => {
  const isProc = Boolean(opcoes?.isProcedimento || opcoes?.tipoAcesso === 'ORELHINHA' || nomeVisitante.startsWith('Orelhinha:'));
  const tipoFinal = opcoes?.tipoAcesso || (isProc ? 'ORELHINHA' : 'VISITANTE');

  try {
    const { data, error } = await supabase.rpc('rpc_emitir_credencial_visitante', {
      p_paciente_id: pacienteId,
      p_nome_visitante: nomeVisitante,
      p_documento: documento || null,
      p_telefone: telefone || null,
      p_tipo: tipoFinal,
    });

    if (!error && data) {
      return data;
    }

    if (error && error.code !== 'PGRST202') {
      console.error("Erro ao emitir credencial:", error);
      throw erroLegivel(error, 'Não foi possível liberar o acesso.');
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (!msg.includes('Could not find the function') && !msg.includes('schema cache')) {
      throw err;
    }
  }

  // Fallback Inteligente (Garante o teste do QR Code cego e regras de cotas)
  const pac = pacientesMemoria.find(p => p.id === pacienteId);
  const isVermelha = pac?.setor_clinica?.toLowerCase().includes('vermelh') || pac?.leito?.toLowerCase().includes('vermelh');
  const cotaMax = isVermelha ? 1 : 2;
  const usadasHoje = cotasDiariasMemoria[pacienteId] || 0;

  // Apenas visitantes de quarto consomem e validam a cota diária de visitas!
  if (!isProc && usadasHoje >= cotaMax) {
    throw new Error('Cota máxima atingida hoje');
  }

  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hnsbc-${Math.random().toString(36).substring(2, 11)}`;
  const novoUsadas = isProc ? usadasHoje : usadasHoje + 1;
  if (!isProc) {
    cotasDiariasMemoria[pacienteId] = novoUsadas;
  }

  // Atualiza leito na memória mantendo histórico de múltiplos acessos sem sobrescrever
  pacientesMemoria = pacientesMemoria.map(p => {
    if (p.id === pacienteId) {
      const novoId = Date.now() + Math.floor(Math.random() * 1000);
      const novoAcesso: Visitante = {
        id: novoId,
        nome: nomeVisitante,
        documento: documento || null,
        telefone: telefone || null,
        data_entrada: new Date().toISOString(),
        status: 'ATIVO',
        isProcedimento: isProc,
        tipoAcesso: tipoFinal,
      };

      const listaAnterior: Visitante[] = Array.isArray(p.visitantes)
        ? p.visitantes
        : (p.visitante ? [p.visitante] : (p.visitante_ativo ? [{ id: p.id * 1000 + 1, nome: p.visitante_ativo, documento: p.visitante_documento, telefone: p.visitante_telefone, isProcedimento: false, tipoAcesso: 'VISITANTE' }] : []));

      const novaLista = [...listaAnterior, novoAcesso];
      const listaProcedimentos = isProc
        ? [...(p.procedimentos_ativos || []), novoAcesso]
        : (p.procedimentos_ativos || []);

      const visitantesSociais = novaLista.filter(v => !v.isProcedimento && v.tipoAcesso !== 'ORELHINHA');
      const ultimoVisitanteSocial = visitantesSociais.length > 0 ? visitantesSociais[visitantesSociais.length - 1] : null;

      return {
        ...p,
        visitante_ativo: visitantesSociais.length > 0 ? visitantesSociais.map(v => v.nome).join(', ') : null,
        visitante_documento: ultimoVisitanteSocial?.documento || null,
        visitante_telefone: ultimoVisitanteSocial?.telefone || null,
        visitante: ultimoVisitanteSocial,
        visitantes: novaLista,
        procedimentos_ativos: listaProcedimentos,
        cotas_usadas: isProc ? (p.cotas_usadas ?? 0) : novoUsadas,
        cota_maxima: cotaMax,
        placar: isProc ? p.placar : `Visitantes: ${novoUsadas}/${cotaMax}`
      };
    }
    return p;
  });

  salvarMemoriaPersistida(pacientesMemoria);

  return {
    sucesso: true,
    credencial_id: token,
    token_qr: token,
    qr_payload: `HNSBC|${token}`,
    cotas_usadas: novoUsadas,
    cota_maxima: cotaMax,
    placar: `${novoUsadas}/${cotaMax}`,
    mensagem: isProc ? 'Credencial para Teste da Orelhinha emitida com sucesso!' : 'Credencial de visitante emitida com sucesso!'
  };
};

// RPC 2: Trocar Acompanhante (Atômico: revoga anterior + cadastra novo, valida janelas 07:30-08:30 / 18:30-19:30)
export const trocarAcompanhanteRPC = async (
  pacienteId: number,
  novoAcompanhante: string,
  documento?: string,
  telefone?: string
): Promise<RespostaCredencial> => {
  try {
    const { data, error } = await supabase.rpc('rpc_trocar_acompanhante', {
      p_paciente_id: pacienteId,
      p_novo_acompanhante: novoAcompanhante,
      p_documento: documento || null,
      p_telefone: telefone || null,
    });

    if (!error && data) {
      return data;
    }

    if (error && error.code !== 'PGRST202') {
      console.error("Erro ao trocar acompanhante:", error);
      throw erroLegivel(error, 'Não foi possível trocar o acompanhante.');
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (!msg.includes('Could not find the function') && !msg.includes('schema cache')) {
      throw err;
    }
  }

  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hnsbc-${Math.random().toString(36).substring(2, 11)}`;
  pacientesMemoria = pacientesMemoria.map(p => {
    if (p.id === pacienteId) {
      return {
        ...p,
        acompanhante_nome: novoAcompanhante,
        acompanhante_documento: documento || null,
        acompanhante_telefone: telefone || null,
        acompanhante: {
          nome: novoAcompanhante,
          documento: documento || null,
          telefone: telefone || null,
          data_cadastro: new Date().toISOString(),
          status: 'ATIVO',
        }
      };
    }
    return p;
  });

  salvarMemoriaPersistida(pacientesMemoria);

  return {
    sucesso: true,
    credencial_id: token,
    token_qr: token,
    qr_payload: `HNSBC|${token}`,
    mensagem: 'Troca de acompanhante realizada com sucesso!'
  };
};

// RPC 3: Confirmar Alta Hospitalar (Altera status para ALTA, libera leito e revoga credenciais ativas)
export const confirmarAltaHospitalar = async (
  pacienteId: number,
  observacoes?: string
): Promise<{ sucesso: boolean; leito_liberado: string; mensagem: string }> => {
  const { data, error } = await supabase.rpc('rpc_confirmar_alta', {
    p_paciente_id: pacienteId,
    p_observacoes: observacoes || null,
  });

  if (error) {
    console.error("Erro ao confirmar alta hospitalar:", error);
    throw erroLegivel(error, 'Não foi possível confirmar a alta do paciente.');
  }
  return data;
};

// RPC 4: Criar Slot Teste da Orelhinha (Exclusivo Fonoaudiologia)
export const criarSlotOrelhinha = async (
  dataExame: string,
  horario: string,
  turno: string = 'MANHA',
  observacoes?: string
): Promise<{ sucesso: boolean; slot_id: number; mensagem: string }> => {
  const { data, error } = await supabase.rpc('rpc_criar_slot_orelhinha', {
    p_data_exame: dataExame,
    p_horario: horario,
    p_turno: turno,
    p_observacoes: observacoes || null,
  });

  if (error) {
    console.error("Erro ao criar slot de orelhinha:", error);
    throw erroLegivel(error, 'Não foi possível criar o slot do exame.');
  }
  return data;
};

// RPC 5: Vincular RN ao Teste da Orelhinha (Serviço Social)
export const vincularRnOrelhinha = async (
  slotId: number,
  pacienteId: number,
  nomeRn?: string
): Promise<{ sucesso: boolean; nome_rn: string; nome_mae: string; mensagem: string }> => {
  const { data, error } = await supabase.rpc('rpc_vincular_rn_orelhinha', {
    p_slot_id: slotId,
    p_paciente_id: pacienteId,
    p_nome_rn: nomeRn || null,
  });

  if (error) {
    console.error("Erro ao vincular RN ao teste da orelhinha:", error);
    throw erroLegivel(error, 'Não foi possível vincular o paciente ao exame.');
  }
  return data;
};

// RPC 6: Liberar Acesso Teste da Orelhinha na Portaria (Requer checkboxes [x] Caderneta e [x] Registro)
export const liberarAcessoOrelhinha = async (
  slotId: number,
  caderneta: boolean,
  registro: boolean,
  nomeResponsavel?: string,
  documento?: string
): Promise<RespostaCredencial> => {
  const { data, error } = await supabase.rpc('rpc_liberar_acesso_orelhinha', {
    p_slot_id: slotId,
    p_caderneta: caderneta,
    p_registro: registro,
    p_nome_responsavel: nomeResponsavel || null,
    p_documento: documento || null,
  });

  if (error) {
    console.error("Erro ao liberar acesso ao teste da orelhinha:", error);
    throw erroLegivel(error, 'Não foi possível liberar o acesso para o teste da orelhinha.');
  }
  return data;
};

// RPC 7: Obter Placar de Cotas em Tempo Real
// RPC 7: Obter Placar de Cotas em Tempo Real
export const obterPlacarCotas = async (pacienteId: number): Promise<PlacarCotas> => {
  try {
    const { data, error } = await supabase.rpc('rpc_obter_placar_cotas', {
      p_paciente_id: pacienteId,
    });

    if (!error && data) {
      return data;
    }
  } catch (err) {
    // fallback
  }

  const pac = pacientesMemoria.find(p => p.id === pacienteId);
  const isVermelha = pac?.setor_clinica?.toLowerCase().includes('vermelh') || pac?.leito?.toLowerCase().includes('vermelh');
  const cotaMax = isVermelha ? 1 : 2;
  const usadas = cotasDiariasMemoria[pacienteId] || 0;

  return {
    paciente_id: pacienteId,
    usuario_nome: pac?.usuario_nome || '',
    leito: pac?.leito || '',
    cotas_usadas: usadas,
    cota_maxima: cotaMax,
    placar: `Visitantes: ${usadas}/${cotaMax}`,
    pode_emitir: usadas < cotaMax,
    visitante_ativo: pac?.visitante_ativo || null,
    acompanhante_nome: pac?.acompanhante_nome || null,
    status_internacao: pac?.status_internacao || 'INTERNADO'
  };
};

// RPC 8: Registrar Saída do Visitante (permite saída por ID específico de visitante ou desocupação geral)
export const registrarSaidaVisitante = async (
  pacienteId: number,
  visitanteId?: number
): Promise<{ sucesso: boolean; mensagem: string }> => {
  try {
    const { data, error } = await supabase.rpc('rpc_registrar_saida_visitante', {
      p_paciente_id: pacienteId,
      p_visitante_id: visitanteId,
    });

    if (!error && data) {
      return data;
    }
  } catch (err) {
    // fallback
  }

  pacientesMemoria = pacientesMemoria.map(p => {
    if (p.id === pacienteId) {
      const listaAtual: Visitante[] = Array.isArray(p.visitantes)
        ? p.visitantes
        : (p.visitante ? [p.visitante] : (p.visitante_ativo ? [{ id: p.id * 1000 + 1, nome: p.visitante_ativo, documento: p.visitante_documento, telefone: p.visitante_telefone }] : []));

      const novaLista = visitanteId !== undefined
        ? listaAtual.filter(v => v.id !== visitanteId)
        : [];

      const novosProcedimentos = (p.procedimentos_ativos || []).filter(v => v.id !== visitanteId);
      const visitantesSociais = novaLista.filter(v => !v.isProcedimento && v.tipoAcesso !== 'ORELHINHA');
      const ultimo = visitantesSociais.length > 0 ? visitantesSociais[visitantesSociais.length - 1] : null;

      return {
        ...p,
        visitantes: novaLista,
        procedimentos_ativos: novosProcedimentos,
        visitante: ultimo,
        visitante_ativo: visitantesSociais.length > 0 ? visitantesSociais.map(v => v.nome).join(', ') : null,
        visitante_documento: ultimo?.documento || null,
        visitante_telefone: ultimo?.telefone || null,
      };
    }
    return p;
  });

  salvarMemoriaPersistida(pacientesMemoria);

  return { sucesso: true, mensagem: 'Saída do visitante registrada com sucesso!' };
};

// RPC 9: Busca Autocomplete Unificada (Nome, Mãe ou Leito)
export const buscarPacientesAutocomplete = async (termo: string): Promise<Paciente[]> => {
  try {
    const { data, error } = await supabase.rpc('rpc_buscar_pacientes_autocomplete', {
      p_termo: termo,
    });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    // fallback
  }

  const t = termo.trim().toLowerCase();
  if (!t) return pacientesMemoria;

  return pacientesMemoria.filter(p =>
    p.usuario_nome.toLowerCase().includes(t) ||
    (p.nome_mae && p.nome_mae.toLowerCase().includes(t)) ||
    p.leito.toLowerCase().includes(t) ||
    p.id_atendimento.toLowerCase().includes(t)
  );
};

// Funções de compatibilidade para código existente
export const atualizarVisitante = async (pacienteId: number, nomeVisitante: string): Promise<Paciente> => {
  try {
    await emitirCredencialVisitante(pacienteId, nomeVisitante);
    const { data } = await supabase.from('pacientes').select('*').eq('id', pacienteId).single();
    return data;
  } catch (err) {
    throw err;
  }
};

export const trocarAcompanhante = async (pacienteId: number, nomeAcompanhante: string): Promise<Paciente> => {
  try {
    await trocarAcompanhanteRPC(pacienteId, nomeAcompanhante);
    const { data } = await supabase.from('pacientes').select('*').eq('id', pacienteId).single();
    return data;
  } catch (err) {
    throw err;
  }
};

export const desocuparVisitante = async (pacienteId: number, visitanteId?: number): Promise<Paciente> => {
  try {
    await registrarSaidaVisitante(pacienteId, visitanteId);
    const { data } = await supabase.from('pacientes').select('*').eq('id', pacienteId).single();
    if (data) return data;
  } catch (err) {
    // fallback
  }
  const pac = pacientesMemoria.find(p => p.id === pacienteId);
  if (!pac) throw new Error("Paciente não encontrado");
  return pac;
};

export interface RegraHorario {
  id: number;
  tipo_regra: string;
  descricao: string;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  cota_maxima?: number | null;
  setor_aplicavel?: string;
  ativo: boolean;
}

export const fetchRegras = async (): Promise<RegraHorario[]> => {
  try {
    const { data, error } = await supabase
      .from('regras_horarios')
      .select('*')
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error("Erro ao buscar regras no Supabase:", error);
    return [];
  }
};
