"""Leitura da matriz RBAC e regras de agenda a partir de `config_fluxos` (dados, não código).

Cache Redis com TTL e invalidação (LISTEN/NOTIFY do Postgres). Se Redis cair, lê direto do
banco; se o banco/config estiver indisponível ou inválido, levanta ConfigIndisponivel
(o chamador NEGA o acesso).
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

from core.erros import ConfigIndisponivel
from schemas.orelhinha import RegrasAgenda

logger = logging.getLogger(__name__)

CHAVES = ("orelhinha.permissoes_campos", "orelhinha.perfis_leitura", "orelhinha.regras_agenda")
CACHE_KEY = "hnsbc:config_fluxos:orelhinha"


@dataclass(frozen=True)
class ConfigOrelhinha:
    permissoes_campos: dict[str, frozenset[str]]
    perfis_leitura: frozenset[str]
    regras: RegrasAgenda

    def campos_editaveis(self, perfil: str) -> frozenset[str]:
        # Perfil não listado => nenhum campo (negado por padrão)
        return self.permissoes_campos.get(perfil, frozenset())


class ConfigSource(Protocol):
    async def carregar(self) -> dict[str, Any]: ...


class Cache(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, valor: str, ttl: int) -> None: ...
    async def delete(self, key: str) -> None: ...


def _parse(bruto: dict[str, Any]) -> ConfigOrelhinha:
    try:
        perm = bruto["orelhinha.permissoes_campos"]
        return ConfigOrelhinha(
            permissoes_campos={str(p): frozenset(map(str, campos)) for p, campos in perm.items()},
            perfis_leitura=frozenset(map(str, bruto["orelhinha.perfis_leitura"])),
            regras=RegrasAgenda.model_validate(bruto["orelhinha.regras_agenda"]),
        )
    except Exception as exc:  # config ausente/mal formada => indisponível
        raise ConfigIndisponivel("config_fluxos inválida") from exc


class ConfigFluxosProvider:
    def __init__(self, source: ConfigSource, cache: Cache | None = None, ttl: int = 60) -> None:
        self._source = source
        self._cache = cache
        self._ttl = ttl

    async def obter(self) -> ConfigOrelhinha:
        if self._cache is not None:
            try:
                cru = await self._cache.get(CACHE_KEY)
                if cru:
                    return _parse(json.loads(cru))
            except ConfigIndisponivel:
                pass  # cache corrompido: recarrega da fonte
            except Exception:
                logger.warning("Redis indisponível; lendo config_fluxos do banco")
        try:
            bruto = await self._source.carregar()
        except Exception as exc:
            logger.error("config_fluxos indisponível")
            raise ConfigIndisponivel("config_fluxos indisponível") from exc
        config = _parse(bruto)
        if self._cache is not None:
            try:
                await self._cache.set(CACHE_KEY, json.dumps(bruto), self._ttl)
            except Exception:
                logger.warning("Falha ao gravar cache de config_fluxos")
        return config

    async def invalidar(self) -> None:
        if self._cache is None:
            return
        try:
            await self._cache.delete(CACHE_KEY)
        except Exception:
            logger.warning("Falha ao invalidar cache de config_fluxos")


class RedisCache:
    """Adaptador sobre redis.asyncio.Redis."""

    def __init__(self, client: Any) -> None:
        self._r = client

    async def get(self, key: str) -> str | None:
        valor = await self._r.get(key)
        return valor.decode() if isinstance(valor, bytes) else valor

    async def set(self, key: str, valor: str, ttl: int) -> None:
        await self._r.set(key, valor, ex=ttl)

    async def delete(self, key: str) -> None:
        await self._r.delete(key)
