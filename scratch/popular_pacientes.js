const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mlzclvxlqiepvxzsxxgn.supabase.co';
const SERVICE_KEY = 'sb_secret_jD-foHcLElrb1YKKI0ODCQ_svpHn7H4';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SETORES = [
  'CLINICA_MEDICA',
  'CLINICA_CIRURGICA',
  'MATERNIDADE',
  'PEDIATRIA',
  'VERMELHA',
  'APARTAMENTO',
  'UTI',
];

const MUNICIPIOS = [
  'ARAPIRACA - AL',
  'MACEIO - AL',
  'PALMEIRA DOS INDIOS - AL',
  'LAGOA DA CANOA - AL',
  'GIRAU DO PONCIANO - AL',
  'PENEDO - AL',
  'SAO SEBASTIAO - AL',
  'CAMPO GRANDE - AL',
  'LIMOEIRO DE ANADIA - AL',
  'TEOTONIO VILELA - AL',
  'FEIRA GRANDE - AL',
  'IGACI - AL',
  'CRAIBAS - AL',
  'JUNQUEIRO - AL',
  'SAO MIGUEL DOS CAMPOS - AL',
];

const PRIMEIROS_NOMES_ADULTOS_M = [
  'ANTONIO', 'JOSE', 'FRANCISCO', 'CARLOS', 'PAULO', 'PEDRO', 'LUCAS', 'LUIZ', 'MARCOS',
  'GABRIEL', 'RAFAEL', 'DANIEL', 'MARCELO', 'BRUNO', 'EDUARDO', 'FELIPE', 'RAIMUNDO', 'RODRIGO', 'MANOEL', 'SEBASTIAO'
];

const PRIMEIROS_NOMES_ADULTOS_F = [
  'MARIA', 'ANA', 'FRANCISCA', 'ANTONIA', 'ADRIANA', 'JULIANA', 'MARCIA', 'FERNANDA', 'PATRICIA',
  'ALINE', 'CAMILA', 'AMANDA', 'BRUNA', 'JESSICA', 'LETICIA', 'BEATRIZ', 'RITA', 'SIMONE', 'ROSANGELA', 'CLEIDE'
];

const NOMES_PEDIATRIA = [
  'ENZO GABRIEL', 'MIGUEL ARCANJO', 'ARTHUR HENRIQUE', 'DAVI LUCCA', 'HEITOR SOARES',
  'BERNARDO SILVA', 'THEO LIMA', 'LORENZO COSTA', 'GABRIEL JUNIOR', 'PEDRO LUCAS',
  'ALICE VITORIA', 'SOPHIA HELENA', 'HELENA MARIA', 'VALENTINA LUZ', 'LAURA BEATRIZ',
  'ISABELLA CRISTINA', 'MANUELA SANTOS', 'JULIA GABRIELA', 'LIVIA MARIA', 'CECILIA ALVES'
];

const NOMES_MATERNIDADE = [
  'RN DE MARIANA SILVA', 'RN DE CAMILA DOS SANTOS', 'RN DE BEATRIZ LIMA', 'RN DE CLAUDIA SOUZA',
  'RN DE TALITA FERREIRA', 'RN DE LARISSA NUNES', 'RN DE JULIANA ALMEIDA', 'RN DE GABRIELA ROCHA',
  'RN DE LETICIA BARROS', 'RN DE VANESSA RIBEIRO', 'RN DE FERNANDA PINTO', 'RN DE AMANDA CAVALCANTE',
  'RN DE MONICA TAVARES', 'RN DE CAROLINE FREITAS', 'RN DE PRISCILA DIAS', 'RN DE LUCIANA MORAIS',
  'RN DE DANIELA CASTRO', 'RN DE THAIS DUARTE', 'RN DE RENATA CARDOSO', 'RN DE BIANCA MENDES'
];

const SOBRENOMES = [
  'SILVA', 'SANTOS', 'OLIVEIRA', 'SOUZA', 'RODRIGUES', 'FERREIRA', 'ALVES', 'PEREIRA',
  'LIMA', 'GOMES', 'COSTA', 'RIBEIRO', 'MARTINS', 'CARVALHO', 'ALMEIDA', 'LOPES', 'SOARES', 'FERNANDES', 'VIEIRA', 'BARBOSA'
];

function gerarCpf() {
  const n = () => Math.floor(Math.random() * 9);
  return `${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}`;
}

function gerarTelefone() {
  const d = () => Math.floor(Math.random() * 9);
  return `(82) 9.${d()}${d()}${d()}${d()}-${d()}${d()}${d()}${d()}`;
}

function dataAleatoria(inicioAno, fimAno) {
  const ano = inicioAno + Math.floor(Math.random() * (fimAno - inicioAno + 1));
  const mes = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const dia = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function gerarPaciente(setor, indice) {
  const leitoFormatado = String(indice).padStart(2, '0');
  const sobrenome1 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  const sobrenome2 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  const municipio = MUNICIPIOS[Math.floor(Math.random() * MUNICIPIOS.length)];
  const nomeMae = `MARIA ${SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)]} ${SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)]}`;

  let nomePaciente = '';
  let dataNasc = '';

  if (setor === 'MATERNIDADE') {
    nomePaciente = NOMES_MATERNIDADE[indice - 1] || `RN DE ${nomeMae}`;
    dataNasc = '2026-10-' + String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  } else if (setor === 'PEDIATRIA') {
    nomePaciente = `${NOMES_PEDIATRIA[indice - 1]} ${sobrenome1}`;
    dataNasc = dataAleatoria(2014, 2025);
  } else {
    const isMasc = Math.random() > 0.5;
    const primeiro = isMasc
      ? PRIMEIROS_NOMES_ADULTOS_M[Math.floor(Math.random() * PRIMEIROS_NOMES_ADULTOS_M.length)]
      : PRIMEIROS_NOMES_ADULTOS_F[Math.floor(Math.random() * PRIMEIROS_NOMES_ADULTOS_F.length)];
    nomePaciente = `${primeiro} ${sobrenome1} ${sobrenome2}`;
    dataNasc = dataAleatoria(1950, 2004);
  }

  // Data de entrada entre 15 e 26 de Outubro de 2026
  const diaEntrada = Math.floor(Math.random() * 11) + 15;
  const horaEntrada = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const minEntrada = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  const dataEntrada = `2026-10-${String(diaEntrada).padStart(2, '0')}T${horaEntrada}:${minEntrada}:00+00:00`;

  return {
    nome: nomePaciente,
    cpf_rg: gerarCpf(),
    data_nascimento: dataNasc,
    municipio,
    telefone_contato: gerarTelefone(),
    nome_mae: nomeMae,
    tipo_leito: setor,
    leito_atual: leitoFormatado,
    data_entrada: dataEntrada,
    status: 'INTERNADO',
  };
}

async function popularBanco() {
  console.log('Iniciando preenchimento com 20 pacientes para cada um dos 7 setores...');
  const todosPacientes = [];

  for (const setor of SETORES) {
    for (let i = 1; i <= 20; i++) {
      todosPacientes.push(gerarPaciente(setor, i));
    }
  }

  console.log(`Total gerado: ${todosPacientes.length} pacientes.`);

  // Inserção em blocos de 20 pacientes por setor para evitar sobrecarga
  for (const setor of SETORES) {
    const lote = todosPacientes.filter((p) => p.tipo_leito === setor);
    console.log(`Inserindo lote do setor ${setor} (${lote.length} pacientes)...`);

    const { data, error } = await supabase.from('pacientes').insert(lote).select();
    if (error) {
      console.error(`Erro ao inserir lote ${setor}:`, error);
    } else {
      console.log(`✓ Setor ${setor} inserido com sucesso (${data.length} registros).`);
    }
  }

  // Verificar contagem total final
  const { count, error: errCount } = await supabase
    .from('pacientes')
    .select('*', { count: 'exact', head: true });

  if (errCount) {
    console.error('Erro ao verificar contagem:', errCount);
  } else {
    console.log(`\n===========================================`);
    console.log(`CONCLUÍDO COM SUCESSO!`);
    console.log(`Total geral de pacientes internados no banco: ${count}`);
    console.log(`===========================================`);
  }
}

popularBanco();
