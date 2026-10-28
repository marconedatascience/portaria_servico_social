"""Contratos Pydantic v2 do módulo Orelhinha.

Armazenado/trafegado SEM máscara: cartao_sus (15 dígitos), telefone (dígitos),
datas ISO `YYYY-MM-DD`, hora `HH:mm`.
Um schema de escrita por perfil de responsabilidade, ambos `extra="forbid"`.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from core.validators import cns_valido, data_iso_estrita, hora_valida, telefone_valido


class OrelhinhaAgendaUpdate(BaseModel):
    """PATCH da agenda (Fonoaudiologia): somente Data e Hora do exame."""

    model_config = ConfigDict(extra="forbid")

    data_exame: date | None = None
    horario: str | None = None
    operation_id: UUID | None = None

    @field_validator("data_exame", mode="before")
    @classmethod
    def _data_estrita(cls, v: object) -> object:
        if isinstance(v, str) and not data_iso_estrita(v):
            raise ValueError("Use o formato AAAA-MM-DD.")
        if v is not None and not isinstance(v, (str, date)):
            raise ValueError("Data inválida.")
        return v

    @field_validator("horario")
    @classmethod
    def _hora(cls, v: str | None) -> str | None:
        if v is not None and not hora_valida(v):
            raise ValueError("Hora inválida. Use HH:mm entre 00:00 e 23:59.")
        return v

    @model_validator(mode="after")
    def _ao_menos_um(self) -> "OrelhinhaAgendaUpdate":
        if self.data_exame is None and self.horario is None:
            raise ValueError("Informe data_exame e/ou horario.")
        return self


class OrelhinhaDemograficoUpdate(BaseModel):
    """PATCH demográfico (Portaria / Serviço Social). operation_id obrigatório (idempotência offline)."""

    model_config = ConfigDict(extra="forbid")

    cartao_sus: str | None = None
    nome_mae: str | None = Field(default=None, min_length=3, max_length=120)
    municipio: str | None = Field(default=None, min_length=2, max_length=120)
    telefone: str | None = None
    operation_id: UUID

    @field_validator("cartao_sus")
    @classmethod
    def _cns(cls, v: str | None) -> str | None:
        if v is not None and not cns_valido(v):
            raise ValueError("Cartão SUS inválido.")
        return v

    @field_validator("telefone")
    @classmethod
    def _tel(cls, v: str | None) -> str | None:
        if v is not None and not telefone_valido(v):
            raise ValueError("Telefone inválido.")
        return v

    @field_validator("nome_mae", "municipio")
    @classmethod
    def _texto(cls, v: str | None) -> str | None:
        if v is None:
            return v
        limpo = " ".join(v.split())
        if len(limpo) < 2:
            raise ValueError("Texto muito curto.")
        return limpo

    @model_validator(mode="after")
    def _ao_menos_um(self) -> "OrelhinhaDemograficoUpdate":
        if all(getattr(self, c) is None for c in ("cartao_sus", "nome_mae", "municipio", "telefone")):
            raise ValueError("Informe ao menos um campo editável.")
        return self


StatusExame = str  # AGENDADO | REAGENDADO | REALIZADO | CANCELADO | ... (vem do banco)


class OrelhinhaItem(BaseModel):
    id: int
    nome_rn: str | None = None
    leito: str | None = None
    cartao_sus: str | None = None
    data_nascimento: date | None = None
    sexo: Literal["F", "M"] | None = None
    nome_mae: str | None = None
    municipio: str | None = None
    telefone: str | None = None
    data_exame: date
    horario: str
    status: StatusExame
    versao: int
    atualizado_em: datetime | None = None


class RegrasAgenda(BaseModel):
    retroatividade_dias: int = Field(ge=0)
    janela_inicio: str
    janela_fim: str
    fuso: str = "America/Maceio"


class OrelhinhaAgendaResponse(BaseModel):
    itens: list[OrelhinhaItem]
    permissoes_campos: list[str]
    regras: RegrasAgenda


class OrelhinhaPermissoesResponse(BaseModel):
    perfil: str
    permissoes_campos: list[str]
    regras: RegrasAgenda
