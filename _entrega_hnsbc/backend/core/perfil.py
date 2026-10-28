"""Identidade do chamador (async). `perfil_atual` é a única fonte do perfil no backend.

O perfil vem SOMENTE de app_metadata do JWT validado no Supabase Auth
(user_metadata é editável pelo próprio usuário). Cabeçalho X-User-Role só com
ALLOW_ROLE_HEADER=true (desenvolvimento), como em core/security.py.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)

PERFIS_VALIDOS = frozenset({"portaria", "servico_social", "fono", "admin"})


@dataclass(frozen=True)
class Usuario:
    id: str | None
    perfil: str


async def _usuario_do_token(token: str) -> Usuario | None:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    chave = os.getenv("SUPABASE_KEY", "")
    if not url or not chave:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{url}/auth/v1/user",
                headers={"apikey": chave, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError:
        logger.error("Falha ao validar token no Supabase Auth")
        return None
    if resp.status_code != 200:
        return None
    dados = resp.json()
    meta = dados.get("app_metadata") or {}
    bruto = meta.get("role") or meta.get("setor")
    perfil = bruto.strip().lower() if isinstance(bruto, str) else ""
    if perfil not in PERFIS_VALIDOS:
        return None
    return Usuario(id=dados.get("id"), perfil=perfil)


async def perfil_atual(
    authorization: str | None = Header(None, alias="Authorization"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
) -> Usuario:
    usuario: Usuario | None = None
    if authorization and authorization.startswith("Bearer "):
        usuario = await _usuario_do_token(authorization.split(" ", 1)[1])
    if usuario is None and x_user_role and os.getenv("ALLOW_ROLE_HEADER", "false").lower() == "true":
        perfil = x_user_role.strip().lower()
        if perfil in PERFIS_VALIDOS:
            usuario = Usuario(id=None, perfil=perfil)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação requerida ou token inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return usuario
