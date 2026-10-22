from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class PerfilUsuario(str, Enum):
    PORTARIA = "portaria"
    FONO = "fono"
    SERVICO_SOCIAL = "servico_social"

class PacienteBase(BaseModel):
    leito: str = Field(..., max_length=30, description="Setor e Leito (ex: APT 101, UTI 05, PS 02)")
    usuario_nome: str = Field(..., min_length=2, max_length=120, description="Nome do Paciente")
    id_atendimento: str = Field(..., max_length=30, description="ID Único do Atendimento")
    municipio: Optional[str] = Field(None, max_length=80, description="Município de Origem")
    acompanhante_nome: Optional[str] = Field(None, max_length=120, description="Nome do Acompanhante Atual")
    visitante_ativo: Optional[str] = Field(None, max_length=120, description="Nome do Visitante Liberado Atualmente")

class PacienteCreate(PacienteBase):
    pass

class Paciente(PacienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data_internacao: datetime

# === NOVOS MODELOS MULTISSETORIAIS (RBAC) ===

class ChecklistDocumentosServicoSocial(BaseModel):
    id_paciente: int
    tem_rg: bool = Field(default=False, description="Xerox do RG anexada")
    tem_cpf: bool = Field(default=False, description="Xerox do CPF anexada")
    tem_sus: bool = Field(default=False, description="Xerox do Cartão SUS anexada")
    tem_comprovante_residencia: bool = Field(default=False, description="Comprovante de Residência anexado")
    observacoes: Optional[str] = Field(None, description="Notas de acompanhamento do Serviço Social")

class AgendamentoFono(BaseModel):
    id: int
    id_paciente: int
    nome_paciente: str
    leito: str
    data_hora_consulta: datetime = Field(..., description="Data e hora marcada para o Teste da Orelhinha")
    status: str = Field(default="Agendado", description="Agendado, Realizado, Cancelado")
    responsavel: Optional[str] = Field(None, description="Pai/Mãe/Responsável legal")

class AgendamentoFonoUpdate(BaseModel):
    data_hora_consulta: datetime
    status: Optional[str] = None
    responsavel: Optional[str] = None
