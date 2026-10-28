from __future__ import annotations

from datetime import date

import httpx
import pytest
from fastapi import FastAPI

from core.config_fluxos import ConfigFluxosProvider
from routers import orelhinha
from services.orelhinha_service import OrelhinhaService
from tests.fakes import FakeCache, FakeRepo, FakeSource


@pytest.fixture(autouse=True)
def _perfil_por_cabecalho(monkeypatch: pytest.MonkeyPatch) -> None:
    # Exercita o caminho real de perfil_atual (modo desenvolvimento)
    monkeypatch.setenv("ALLOW_ROLE_HEADER", "true")


@pytest.fixture
def repo() -> FakeRepo:
    return FakeRepo()


@pytest.fixture
def source() -> FakeSource:
    return FakeSource()


@pytest.fixture
def cache() -> FakeCache:
    return FakeCache()


@pytest.fixture
def app(repo: FakeRepo, source: FakeSource, cache: FakeCache) -> FastAPI:
    app = FastAPI()
    app.include_router(orelhinha.router, prefix="/api/v1/orelhinha")
    provider = ConfigFluxosProvider(source, cache, ttl=60)
    app.state.orelhinha_service = OrelhinhaService(repo, provider, hoje=lambda _fuso: date(2026, 10, 28))
    return app


@pytest.fixture
async def client(app: FastAPI):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        yield c


def como(perfil: str, **extra: str) -> dict[str, str]:
    return {"X-User-Role": perfil, **extra}
