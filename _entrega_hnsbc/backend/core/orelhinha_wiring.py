"""Composição (lifespan) do módulo Orelhinha: pool asyncpg, Redis opcional e invalidação por NOTIFY.

Em main.py:
    from core.orelhinha_wiring import orelhinha_lifespan
    from routers import orelhinha
    app = FastAPI(..., lifespan=orelhinha_lifespan)
    app.include_router(orelhinha.router, prefix="/api/v1/orelhinha", tags=["orelhinha"])
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg
from fastapi import FastAPI

from core.config_fluxos import ConfigFluxosProvider, RedisCache
from repositories.orelhinha_repository_pg import ConfigSourcePg, OrelhinhaRepositoryPg
from services.orelhinha_service import OrelhinhaService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def orelhinha_lifespan(app: FastAPI) -> AsyncIterator[None]:
    dsn = os.environ["DATABASE_URL"]  # conexão Postgres do Supabase (pooler em modo sessão)
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)

    redis_client = None
    cache = None
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            from redis.asyncio import Redis

            redis_client = Redis.from_url(redis_url)
            await redis_client.ping()
            cache = RedisCache(redis_client)
        except Exception:
            logger.warning("Redis indisponível: config_fluxos será lida direto do banco")
            redis_client = None

    provider = ConfigFluxosProvider(
        ConfigSourcePg(pool), cache, ttl=int(os.getenv("CONFIG_FLUXOS_TTL", "60"))
    )

    # Invalidação imediata: o banco emite NOTIFY ao alterar config_fluxos
    listener = await pool.acquire()

    def _ao_notificar(*_args: object) -> None:
        import asyncio

        asyncio.get_running_loop().create_task(provider.invalidar())

    await listener.add_listener("config_fluxos_changed", _ao_notificar)

    app.state.orelhinha_service = OrelhinhaService(OrelhinhaRepositoryPg(pool), provider)
    try:
        yield
    finally:
        await listener.remove_listener("config_fluxos_changed", _ao_notificar)
        await pool.release(listener)
        if redis_client is not None:
            await redis_client.aclose()
        await pool.close()
