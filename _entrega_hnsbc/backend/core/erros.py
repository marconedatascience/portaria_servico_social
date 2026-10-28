"""Erros de domínio da Orelhinha. O router os traduz para HTTP; nada aqui conhece FastAPI."""
from __future__ import annotations

from typing import Any


class ErroDominio(Exception):
    pass


class PermissaoNegada(ErroDominio):
    def __init__(self, motivo: str = "Acesso negado.") -> None:
        super().__init__(motivo)
        self.motivo = motivo


class RegraNegocio(ErroDominio):
    def __init__(self, campo: str, mensagem: str) -> None:
        super().__init__(mensagem)
        self.campo = campo
        self.mensagem = mensagem


class NaoEncontrado(ErroDominio):
    pass


class ConflitoVersao(ErroDominio):
    """Lock otimista: a versão enviada não é a atual. Carrega o registro atual."""

    def __init__(self, atual: dict[str, Any]) -> None:
        super().__init__("Conflito de versão.")
        self.atual = atual


class ConfigIndisponivel(ErroDominio):
    """config_fluxos inacessível: o fallback seguro é NEGAR."""
