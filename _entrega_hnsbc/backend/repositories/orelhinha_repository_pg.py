"""Implementação asyncpg do repositório da Orelhinha.

- Toda escrita roda em transação e informa ao banco quem é o chamador
  (request.jwt.claims + app.operation_id): assim o guard `trg_orelhinha_guard`
  aplica a MESMA matriz RBAC (config_fluxos) e grava a auditoria.
- Lock otimista: UPDATE ... WHERE id = $ AND versao = $.
- Idempotência: orelhinha_operacoes(operation_id) como chave primária.
- SQL parametrizado; nomes de coluna só vêm da lista fixa COLUNAS_ESCRITA.
"""
from __future__ import annotations

import json
from datetime import date, time
from typing import Any
from uuid import UUID

import asyncpg

from core.erros import ConflitoVersao, NaoEncontrado, PermissaoNegada, RegraNegocio
from core.perfil import Usuario
from repositories.orelhinha_repository import Registro, ResultadoAtualizacao

COLUNAS_ESCRITA = frozenset(
    {"data_exame", "horario", "cartao_sus", "nome_mae", "municipio", "telefone"}
)

_SELECT = """
    SELECT id, nome_rn, leito, cartao_sus, data_nascimento, sexo, nome_mae, municipio,
           telefone, data_exame, to_char(horario, 'HH24:MI') AS horario,
           status, versao, atualizado_em
      FROM public.slots_orelhinha
"""


def _registro(row: asyncpg.Record) -> Registro:
    return dict(row)


class OrelhinhaRepositoryPg:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def listar(self) -> list[Registro]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                _SELECT + " WHERE status <> 'DISPONIVEL' ORDER BY data_exame, horario, id"
            )
        return [_registro(r) for r in rows]

    async def obter(self, slot_id: int) -> Registro | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(_SELECT + " WHERE id = $1", slot_id)
        return _registro(row) if row else None

    async def atualizar(
        self,
        slot_id: int,
        campos: dict[str, Any],
        versao_esperada: int,
        operation_id: UUID | None,
        usuario: Usuario,
    ) -> ResultadoAtualizacao:
        if not campos or not set(campos) <= COLUNAS_ESCRITA:
            raise PermissaoNegada("Campo fora da lista de escrita.")
        try:
            return await self._atualizar_tx(slot_id, campos, versao_esperada, operation_id, usuario)
        except asyncpg.UniqueViolationError:
            # operação concorrente com o mesmo operation_id: reaplica = devolve estado atual
            atual = await self.obter(slot_id)
            if atual is None:
                raise NaoEncontrado() from None
            return ResultadoAtualizacao(atual, True)
        except asyncpg.InsufficientPrivilegeError:
            raise PermissaoNegada("Perfil sem permissão para alterar este campo.") from None
        except asyncpg.CheckViolationError:
            raise RegraNegocio("valor", "Valor rejeitado pelas regras do banco.") from None

    async def _atualizar_tx(
        self,
        slot_id: int,
        campos: dict[str, Any],
        versao_esperada: int,
        operation_id: UUID | None,
        usuario: Usuario,
    ) -> ResultadoAtualizacao:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                claims = json.dumps(
                    {
                        "sub": usuario.id,
                        "role": "authenticated",
                        "app_metadata": {"role": usuario.perfil},
                    }
                )
                await conn.execute(
                    "SELECT set_config('request.jwt.claims', $1, true),"
                    "       set_config('app.operation_id', $2, true)",
                    claims,
                    str(operation_id) if operation_id else "",
                )

                if operation_id is not None:
                    ja = await conn.fetchval(
                        "SELECT 1 FROM public.orelhinha_operacoes WHERE operation_id = $1",
                        operation_id,
                    )
                    if ja:
                        row = await conn.fetchrow(_SELECT + " WHERE id = $1", slot_id)
                        if row is None:
                            raise NaoEncontrado()
                        return ResultadoAtualizacao(_registro(row), True)

                nomes = list(campos)
                sets = ", ".join(f"{n} = ${i + 3}" for i, n in enumerate(nomes))
                valores = [self._converter(n, campos[n]) for n in nomes]
                atualizado = await conn.fetchval(
                    f"UPDATE public.slots_orelhinha SET {sets} "  # nomes validados (COLUNAS_ESCRITA)
                    "WHERE id = $1 AND versao = $2 RETURNING id",
                    slot_id,
                    versao_esperada,
                    *valores,
                )
                if atualizado is None:
                    atual = await conn.fetchrow(_SELECT + " WHERE id = $1", slot_id)
                    if atual is None:
                        raise NaoEncontrado()
                    raise ConflitoVersao(_registro(atual))

                row = await conn.fetchrow(_SELECT + " WHERE id = $1", slot_id)
                assert row is not None
                if operation_id is not None:
                    await conn.execute(
                        "INSERT INTO public.orelhinha_operacoes (operation_id, slot_id, versao)"
                        " VALUES ($1, $2, $3)",
                        operation_id,
                        slot_id,
                        row["versao"],
                    )
                return ResultadoAtualizacao(_registro(row), False)

    @staticmethod
    def _converter(coluna: str, valor: Any) -> Any:
        if coluna == "horario" and isinstance(valor, str):
            h, m = valor.split(":")
            return time(int(h), int(m))
        if coluna == "data_exame" and isinstance(valor, str):
            return date.fromisoformat(valor)
        return valor


class ConfigSourcePg:
    """Lê as chaves de config_fluxos usadas pela Orelhinha."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def carregar(self) -> dict[str, Any]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT chave, valor FROM public.config_fluxos WHERE chave LIKE 'orelhinha.%'"
            )
        return {r["chave"]: json.loads(r["valor"]) if isinstance(r["valor"], str) else r["valor"] for r in rows}
