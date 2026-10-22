from fastapi import APIRouter
from typing import List
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

router = APIRouter()

class RegraHorario(BaseModel):
    id: int
    tipo_regra: str
    descricao: str
    horario_inicio: str | None
    horario_fim: str | None
    ativo: bool = True

db_regras = [
    RegraHorario(id=1, tipo_regra="Visita Vermelha", descricao="Horário para visitação na área vermelha", horario_inicio="16:00", horario_fim="17:00"),
    RegraHorario(id=2, tipo_regra="Troca de Acompanhante", descricao="Troca de acompanhantes matutina", horario_inicio="07:30", horario_fim="08:30"),
    RegraHorario(id=3, tipo_regra="Teste da Orelhinha", descricao="Fluxo de liberação para exame", horario_inicio=None, horario_fim=None),
    RegraHorario(id=4, tipo_regra="Liberação de Óbito", descricao="Fluxo humanizado para familiares", horario_inicio=None, horario_fim=None),
]

@router.get("/", response_model=List[RegraHorario])
def listar_regras():
    """Retorna todas as regras e fluxos da Portaria."""
    return db_regras

@router.get("/ativas")
def verificar_regras_ativas():
    """Verifica quais regras baseadas em horário estão ativas no momento atual."""
    agora = datetime.now(timezone(timedelta(hours=-3))).time()  # horário de Brasília
    ativas = []
    
    for regra in db_regras:
        if regra.horario_inicio and regra.horario_fim:
            inicio = datetime.strptime(regra.horario_inicio, "%H:%M").time()
            fim = datetime.strptime(regra.horario_fim, "%H:%M").time()
            if inicio <= agora <= fim:
                ativas.append(regra)
                
    return {"regras_ativas": ativas, "hora_atual": str(agora)}
