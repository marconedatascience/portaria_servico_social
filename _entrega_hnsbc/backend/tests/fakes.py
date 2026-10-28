"""Fakes em memória com a mesma semântica do repositório PG (versao, idempotência, conflito)."""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any
from uuid import UUID

from core.erros import ConflitoVersao, NaoEncontrado
from core.perfil import Usuario
from repositories.orelhinha_repository import Registro, ResultadoAtualizacao

CNS_VALIDO = "800000000000001"  # provisório (inicia em 8) com DV correto


def registro_base(**extra: Any) -> Registro:
    base: Registro = {
        "id": 1,
        "nome_rn": "RN de Maria",
        "leito": "Maternidade 03",
        "cartao_sus": CNS_VALIDO,
        "data_nascimento": date(2026, 10, 20),
        "sexo": "F",
        "nome_mae": "Maria Eduarda da Silva",
        "municipio": "Arapiraca",
        "telefone": "82998765432",
        "data_exame": date(2026, 10, 28),
        "horario": "09:00",
        "status": "AGENDADO",
        "versao": 1,
        "atualizado_em": None,
    }
    base.update(extra)
    return base


class FakeRepo:
    def __init__(self, registros: list[Registro] | None = None) -> None:
        self.dados: dict[int, Registro] = {r["id"]: deepcopy(r) for r in (registros or [registro_base()])}
        self.operacoes: set[UUID] = set()
        self.escritas = 0

    async def listar(self) -> list[Registro]:
        return [deepcopy(r) for r in self.dados.values()]

    async def obter(self, slot_id: int) -> Registro | None:
        r = self.dados.get(slot_id)
        return deepcopy(r) if r else None

    async def atualizar(
        self, slot_id: int, campos: dict[str, Any], versao_esperada: int, operation_id: UUID | None, usuario: Usuario
    ) -> ResultadoAtualizacao:
        atual = self.dados.get(slot_id)
        if atual is None:
            raise NaoEncontrado()
        if operation_id is not None and operation_id in self.operacoes:
            return ResultadoAtualizacao(deepcopy(atual), True)
        if atual["versao"] != versao_esperada:
            raise ConflitoVersao(deepcopy(atual))
        atual.update(campos)
        atual["versao"] += 1
        self.escritas += 1
        if operation_id is not None:
            self.operacoes.add(operation_id)
        return ResultadoAtualizacao(deepcopy(atual), False)


class FakeSource:
    def __init__(self, bruto: dict[str, Any] | None = None, falhar: bool = False) -> None:
        self.falhar = falhar
        self.bruto = bruto or {
            "orelhinha.permissoes_campos": {
                "fono": ["data_exame", "horario"],
                "portaria": ["cartao_sus", "nome_mae", "municipio", "telefone"],
                "servico_social": ["cartao_sus", "nome_mae", "municipio", "telefone"],
            },
            "orelhinha.perfis_leitura": ["fono", "portaria", "servico_social", "admin"],
            "orelhinha.regras_agenda": {
                "retroatividade_dias": 1,
                "janela_inicio": "07:00",
                "janela_fim": "18:00",
                "fuso": "America/Maceio",
            },
        }
        self.leituras = 0

    async def carregar(self) -> dict[str, Any]:
        self.leituras += 1
        if self.falhar:
            raise ConnectionError("banco fora")
        return self.bruto


class FakeCache:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, valor: str, ttl: int) -> None:
        self.store[key] = valor

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)
