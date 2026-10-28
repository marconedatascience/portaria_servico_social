"""Casos de uso da Orelhinha. Sem FastAPI, sem SQL: depende só das portas
(OrelhinhaRepository e ConfigFluxosProvider). Toda permissão vem de config_fluxos."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

from core.config_fluxos import ConfigFluxosProvider, ConfigOrelhinha
from core.erros import ConflitoVersao, NaoEncontrado, PermissaoNegada, RegraNegocio
from core.perfil import Usuario
from repositories.orelhinha_repository import OrelhinhaRepository, Registro
from schemas.orelhinha import (
    OrelhinhaAgendaResponse,
    OrelhinhaAgendaUpdate,
    OrelhinhaDemograficoUpdate,
    OrelhinhaItem,
    OrelhinhaPermissoesResponse,
)

logger = logging.getLogger(__name__)  # nunca logar PII: apenas ids, perfil e nomes de campo

CAMPOS_PII = ("cartao_sus", "telefone")


def _ocultar(valor: str | None) -> str | None:
    """Mantém só os 4 últimos caracteres (LGPD) para quem não edita o campo."""
    if not valor:
        return valor
    return "*" * max(len(valor) - 4, 0) + valor[-4:]


class OrelhinhaService:
    def __init__(
        self,
        repo: OrelhinhaRepository,
        config: ConfigFluxosProvider,
        hoje: Callable[[str], date] | None = None,
    ) -> None:
        self._repo = repo
        self._config = config
        self._hoje = hoje or (lambda fuso: datetime.now(ZoneInfo(fuso)).date())

    # --- leitura -----------------------------------------------------------
    async def permissoes(self, usuario: Usuario) -> OrelhinhaPermissoesResponse:
        cfg = await self._exigir_leitura(usuario)
        return OrelhinhaPermissoesResponse(
            perfil=usuario.perfil,
            permissoes_campos=sorted(cfg.campos_editaveis(usuario.perfil)),
            regras=cfg.regras,
        )

    async def listar(self, usuario: Usuario) -> OrelhinhaAgendaResponse:
        cfg = await self._exigir_leitura(usuario)
        editaveis = cfg.campos_editaveis(usuario.perfil)
        registros = await self._repo.listar()
        return OrelhinhaAgendaResponse(
            itens=[self._item(r, editaveis) for r in registros],
            permissoes_campos=sorted(editaveis),
            regras=cfg.regras,
        )

    # --- escrita -----------------------------------------------------------
    async def exigir_alguma_permissao(self, usuario: Usuario, campos: frozenset[str]) -> None:
        """Usado como guarda de rota: 403 antes de qualquer validação do corpo."""
        cfg = await self._config.obter()
        if not (cfg.campos_editaveis(usuario.perfil) & campos):
            raise PermissaoNegada("Perfil sem permissão para alterar estes campos.")

    async def atualizar_agenda(
        self, usuario: Usuario, slot_id: int, dados: OrelhinhaAgendaUpdate, versao: int
    ) -> tuple[OrelhinhaItem, bool]:
        cfg = await self._config.obter()
        campos = dados.model_dump(exclude={"operation_id"}, exclude_none=True)
        self._exigir_campos(cfg, usuario, campos)

        atual = await self._repo.obter(slot_id)
        if atual is None:
            raise NaoEncontrado()
        self._validar_agenda(cfg, atual, campos)

        res = await self._gravar(cfg, usuario, slot_id, campos, versao, dados.operation_id)
        logger.info("orelhinha agenda atualizada slot=%s perfil=%s campos=%s", slot_id, usuario.perfil, sorted(campos))
        return self._item(res.registro, cfg.campos_editaveis(usuario.perfil)), res.reaplicada

    async def atualizar_demografico(
        self, usuario: Usuario, slot_id: int, dados: OrelhinhaDemograficoUpdate, versao: int
    ) -> tuple[OrelhinhaItem, bool]:
        cfg = await self._config.obter()
        campos = dados.model_dump(exclude={"operation_id"}, exclude_none=True)
        self._exigir_campos(cfg, usuario, campos)

        res = await self._gravar(cfg, usuario, slot_id, campos, versao, dados.operation_id)
        logger.info("orelhinha demografico atualizado slot=%s perfil=%s campos=%s", slot_id, usuario.perfil, sorted(campos))
        return self._item(res.registro, cfg.campos_editaveis(usuario.perfil)), res.reaplicada

    # --- internos ----------------------------------------------------------
    async def _gravar(self, cfg, usuario, slot_id, campos, versao, operation_id):  # noqa: ANN001
        try:
            return await self._repo.atualizar(slot_id, campos, versao, operation_id, usuario)
        except ConflitoVersao as conflito:
            atual = self._item(conflito.atual, cfg.campos_editaveis(usuario.perfil))
            raise ConflitoVersao(atual.model_dump(mode="json")) from None

    async def _exigir_leitura(self, usuario: Usuario) -> ConfigOrelhinha:
        cfg = await self._config.obter()
        if usuario.perfil not in cfg.perfis_leitura:
            raise PermissaoNegada("Perfil sem acesso à agenda.")
        return cfg

    @staticmethod
    def _exigir_campos(cfg: ConfigOrelhinha, usuario: Usuario, campos: dict[str, object]) -> None:
        negados = set(campos) - cfg.campos_editaveis(usuario.perfil)
        if negados:
            raise PermissaoNegada(f"Perfil sem permissão para alterar: {', '.join(sorted(negados))}.")

    def _validar_agenda(self, cfg: ConfigOrelhinha, atual: Registro, campos: dict[str, object]) -> None:
        regras = cfg.regras
        data_exame = campos.get("data_exame", atual["data_exame"])
        horario = campos.get("horario", atual["horario"])
        if "data_exame" in campos:
            minimo = self._hoje(regras.fuso) - timedelta(days=regras.retroatividade_dias)
            if data_exame < minimo:  # type: ignore[operator]
                raise RegraNegocio("data_exame", "Data do exame anterior ao limite de retroatividade.")
            nasc = atual.get("data_nascimento")
            if nasc is not None and data_exame < nasc:  # type: ignore[operator]
                raise RegraNegocio("data_exame", "Data do exame anterior ao nascimento.")
        if "horario" in campos and not (regras.janela_inicio <= str(horario) <= regras.janela_fim):
            raise RegraNegocio(
                "horario", f"Horário fora da janela de atendimento ({regras.janela_inicio}–{regras.janela_fim})."
            )

    @staticmethod
    def _item(registro: Registro, editaveis: frozenset[str]) -> OrelhinhaItem:
        dados = dict(registro)
        for campo in CAMPOS_PII:
            if campo not in editaveis:
                dados[campo] = _ocultar(dados.get(campo))
        return OrelhinhaItem.model_validate(dados)
