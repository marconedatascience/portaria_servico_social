import logging
from datetime import datetime, time, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from schemas.crm_models import Paciente, PacienteCreate, Visitante
from core.security import verificar_perfil

logger = logging.getLogger("auditoria.pacientes")

# Janela permitida para troca de acompanhante (regra da Portaria)
JANELA_TROCA_INICIO = time(7, 30)
JANELA_TROCA_FIM = time(8, 30)

# Horário de Brasília fixo (UTC-3, sem horário de verão desde 2019).
# Evita depender do fuso do servidor e do pacote tzdata no Windows.
FUSO_BRASILIA = timezone(timedelta(hours=-3))

def agora_brasilia() -> datetime:
    return datetime.now(FUSO_BRASILIA)

# Mesma dependência no router e nos endpoints (o FastAPI a executa uma vez por requisição)
perfil_dep = verificar_perfil(["portaria", "servico_social"])

# Todas as rotas exigem perfil autenticado (dados de saúde - LGPD)
router = APIRouter(dependencies=[Depends(perfil_dep)])

class NomeIn(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)

class VisitanteIn(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)
    documento: Optional[str] = None
    telefone: Optional[str] = None
    is_procedimento: bool = False
    tipo_acesso: str = "VISITANTE"

# Simulação de banco de dados em memória para testarmos as rotas rapidamente
db_pacientes = [
    Paciente(
        id=1,
        leito="APT 101",
        usuario_nome="João da Silva",
        id_atendimento="ATD-1001",
        municipio="São Paulo",
        acompanhante_nome="Maria da Silva",
        visitante_ativo="Carlos da Silva",
        visitantes=[
            Visitante(
                id=1,
                nome="Carlos da Silva",
                documento="111.222.333-44",
                telefone="(82) 99999-1111",
                data_entrada=datetime.now(),
                status="ATIVO",
                isProcedimento=False,
                tipoAcesso="VISITANTE"
            )
        ],
        data_internacao=datetime.now()
    ),
    Paciente(
        id=2,
        leito="UTI 05",
        usuario_nome="Ana Oliveira",
        id_atendimento="ATD-1002",
        municipio="Campinas",
        acompanhante_nome="Pedro Oliveira",
        visitante_ativo=None,
        visitantes=[],
        data_internacao=datetime.now()
    )
]

@router.get("/", response_model=List[Paciente])
def listar_pacientes():
    """Retorna a lista de pacientes internados para o Dashboard 360º."""
    return db_pacientes

@router.get("/{paciente_id}", response_model=Paciente)
def obter_paciente(paciente_id: int):
    """Busca os dados do paciente por ID e popula o estado local no front-end após F5 (Hidratação)."""
    for p in db_pacientes:
        if p.id == paciente_id:
            return p
    raise HTTPException(status_code=404, detail="Paciente não encontrado")

@router.post("/", response_model=Paciente)
def registrar_paciente(paciente_in: PacienteCreate):
    """Registra um novo paciente no sistema."""
    novo_id = max((p.id for p in db_pacientes), default=0) + 1
    novo_paciente = Paciente(
        id=novo_id,
        data_internacao=datetime.now(),
        **paciente_in.model_dump()
    )
    db_pacientes.append(novo_paciente)
    return novo_paciente

@router.post("/{paciente_id}/visitantes", response_model=Paciente)
@router.post("/{paciente_id}/visitante", response_model=Paciente)
def adicionar_visitante(paciente_id: int, body: VisitanteIn, perfil: str = Depends(perfil_dep)):
    """Criação de visitante via POST: substitui qualquer lógica de UPDATE por INSERT/$push para adicionar ao array de visitantes."""
    for p in db_pacientes:
        if p.id == paciente_id:
            novo_id = len(p.visitantes) + 1
            novo_vis = Visitante(
                id=novo_id,
                nome=body.nome,
                documento=body.documento,
                telefone=body.telefone,
                data_entrada=datetime.now(),
                status="ATIVO",
                isProcedimento=body.is_procedimento,
                tipoAcesso=body.tipo_acesso
            )
            # Persistência: INSERT / $push no array de visitantes (sem UPDATE/sobrescrita)
            p.visitantes.append(novo_vis)

            # Atualiza resumo textual apenas para visitantes sociais de quarto
            visitantes_ativos = [v.nome for v in p.visitantes if not v.isProcedimento and v.status == "ATIVO"]
            p.visitante_ativo = ", ".join(visitantes_ativos) if visitantes_ativos else None

            logger.info("visitante_adicionado_array paciente_id=%s total_visitantes=%s perfil=%s em=%s", 
                        paciente_id, len(p.visitantes), perfil, agora_brasilia().isoformat())
            return p
    raise HTTPException(status_code=404, detail="Paciente não encontrado")

@router.put("/{paciente_id}/acompanhante", response_model=Paciente)
def trocar_acompanhante(paciente_id: int, body: NomeIn, perfil: str = Depends(perfil_dep)):
    """Define/troca o acompanhante. A TROCA só é permitida das 07h30 às 08h30 (mesma regra do banco)."""
    agora = agora_brasilia()
    for p in db_pacientes:
        if p.id == paciente_id:
            eh_troca = p.acompanhante_nome is not None and p.acompanhante_nome != body.nome
            if eh_troca and not (JANELA_TROCA_INICIO <= agora.time() <= JANELA_TROCA_FIM):
                raise HTTPException(
                    status_code=409,
                    detail="Troca de acompanhante permitida apenas das 07h30 às 08h30."
                )
            p.acompanhante_nome = body.nome
            # Sem nomes no log (LGPD); o histórico completo fica em auditoria_pacientes no banco.
            logger.info("acompanhante_definido paciente_id=%s perfil=%s troca=%s em=%s", paciente_id, perfil, eh_troca, agora.isoformat())
            return p
    raise HTTPException(status_code=404, detail="Paciente não encontrado")
