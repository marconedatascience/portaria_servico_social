"""Router da Orelhinha: só HTTP. Traduz erros de domínio; a regra mora no service."""
from __future__ import annotations

import re
from typing import NoReturn

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status

from core.erros import (
    ConfigIndisponivel,
    ConflitoVersao,
    NaoEncontrado,
    PermissaoNegada,
    RegraNegocio,
)
from core.perfil import Usuario, perfil_atual
from schemas.orelhinha import (
    OrelhinhaAgendaResponse,
    OrelhinhaAgendaUpdate,
    OrelhinhaDemograficoUpdate,
    OrelhinhaItem,
    OrelhinhaPermissoesResponse,
)
from services.orelhinha_service import OrelhinhaService

router = APIRouter()

# Campos que cada endpoint trata (estrutura da API, não regra de permissão:
# QUEM pode editá-los vem de config_fluxos).
CAMPOS_AGENDA = frozenset({"data_exame", "horario"})
CAMPOS_DEMOGRAFICOS = frozenset({"cartao_sus", "nome_mae", "municipio", "telefone"})

_IF_MATCH = re.compile(r'^(?:W/)?"?(\d+)"?$')


def get_service(request: Request) -> OrelhinhaService:
    return request.app.state.orelhinha_service


def _http(exc: Exception) -> NoReturn:
    if isinstance(exc, (PermissaoNegada, ConfigIndisponivel)):
        # Fallback seguro: sem config_fluxos => nega
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Acesso negado.") from None
    if isinstance(exc, NaoEncontrado):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Registro não encontrado.") from None
    if isinstance(exc, RegraNegocio):
        raise HTTPException(
            422,
            detail=[{"loc": ["body", exc.campo], "msg": exc.mensagem, "type": "regra_negocio"}],
        ) from None
    if isinstance(exc, ConflitoVersao):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail={"codigo": "conflito_versao", "atual": exc.atual}
        ) from None
    raise exc


def versao_if_match(if_match: str | None = Header(None, alias="If-Match")) -> int:
    if if_match is None:
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, detail="Cabeçalho If-Match (versao) obrigatório.")
    m = _IF_MATCH.match(if_match.strip())
    if not m:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="If-Match inválido.")
    return int(m.group(1))


def _guarda(campos: frozenset[str]):
    async def dependencia(
        usuario: Usuario = Depends(perfil_atual),
        service: OrelhinhaService = Depends(get_service),
    ) -> Usuario:
        try:
            await service.exigir_alguma_permissao(usuario, campos)
        except Exception as exc:
            _http(exc)
        return usuario

    return dependencia


@router.get("/permissoes", response_model=OrelhinhaPermissoesResponse)
async def permissoes(
    usuario: Usuario = Depends(perfil_atual), service: OrelhinhaService = Depends(get_service)
) -> OrelhinhaPermissoesResponse:
    try:
        return await service.permissoes(usuario)
    except Exception as exc:
        _http(exc)


@router.get("/agenda", response_model=OrelhinhaAgendaResponse)
async def listar_agenda(
    usuario: Usuario = Depends(perfil_atual), service: OrelhinhaService = Depends(get_service)
) -> OrelhinhaAgendaResponse:
    try:
        return await service.listar(usuario)
    except Exception as exc:
        _http(exc)


@router.patch("/agenda/{slot_id}", response_model=OrelhinhaItem)
async def patch_agenda(
    slot_id: int,
    dados: OrelhinhaAgendaUpdate,
    response: Response,
    versao: int = Depends(versao_if_match),
    usuario: Usuario = Depends(_guarda(CAMPOS_AGENDA)),  # 403 antes de validar o corpo
    service: OrelhinhaService = Depends(get_service),
) -> OrelhinhaItem:
    try:
        item, reaplicada = await service.atualizar_agenda(usuario, slot_id, dados, versao)
    except Exception as exc:
        _http(exc)
    response.headers["ETag"] = f'"{item.versao}"'
    if reaplicada:
        response.headers["Idempotent-Replay"] = "true"
    return item


@router.patch("/agenda/{slot_id}/demografico", response_model=OrelhinhaItem)
async def patch_demografico(
    slot_id: int,
    dados: OrelhinhaDemograficoUpdate,
    response: Response,
    versao: int = Depends(versao_if_match),
    usuario: Usuario = Depends(_guarda(CAMPOS_DEMOGRAFICOS)),
    service: OrelhinhaService = Depends(get_service),
) -> OrelhinhaItem:
    try:
        item, reaplicada = await service.atualizar_demografico(usuario, slot_id, dados, versao)
    except Exception as exc:
        _http(exc)
    response.headers["ETag"] = f'"{item.versao}"'
    if reaplicada:
        response.headers["Idempotent-Replay"] = "true"
    return item
