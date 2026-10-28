"""Porta do repositório (Clean Architecture). A implementação real está em
orelhinha_repository_pg.py; os testes usam um fake em memória com a mesma semântica."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

from core.perfil import Usuario

Registro = dict[str, Any]


@dataclass(frozen=True)
class ResultadoAtualizacao:
    registro: Registro
    reaplicada: bool  # True quando o operation_id já havia sido processado (idempotência)


class OrelhinhaRepository(Protocol):
    async def listar(self) -> list[Registro]: ...

    async def obter(self, slot_id: int) -> Registro | None: ...

    async def atualizar(
        self,
        slot_id: int,
        campos: dict[str, Any],
        versao_esperada: int,
        operation_id: UUID | None,
        usuario: Usuario,
    ) -> ResultadoAtualizacao:
        """Atualiza com lock otimista.
        Levanta NaoEncontrado, ConflitoVersao(atual) ou PermissaoNegada (guard do banco)."""
        ...
