"""Validações puras (sem I/O) compartilhadas por schemas e serviços da Orelhinha."""
from __future__ import annotations

import re

_SO_DIGITOS = re.compile(r"^\d+$")
_HORA = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_DATA_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")

CNS_INICIAIS_VALIDAS = frozenset("12789")


def so_digitos(valor: str) -> str:
    return "".join(c for c in valor if c.isdigit())


def cns_valido(cns: str) -> bool:
    """Valida CNS (Cartão Nacional de Saúde): 15 dígitos, iniciais 1/2/7/8/9 e dígito verificador."""
    if len(cns) != 15 or not _SO_DIGITOS.match(cns) or cns[0] not in CNS_INICIAIS_VALIDAS:
        return False
    if cns[0] in "12":  # definitivo, derivado do PIS/PASEP
        pis = cns[:11]
        soma = sum(int(d) * (15 - i) for i, d in enumerate(pis))
        resto = soma % 11
        dv = 0 if resto == 0 else 11 - resto
        if dv == 10:
            soma += 2
            dv = 11 - (soma % 11)
            esperado = f"{pis}001{dv}"
        else:
            esperado = f"{pis}000{dv}"
        return cns == esperado
    # provisório (7, 8, 9)
    soma = sum(int(d) * (15 - i) for i, d in enumerate(cns))
    return soma % 11 == 0


def telefone_valido(tel: str) -> bool:
    """Apenas dígitos. Fixo: DDD+8. Celular: DDD+9 iniciando em 9. DDD 11-99."""
    if not _SO_DIGITOS.match(tel) or len(tel) not in (10, 11):
        return False
    if not 11 <= int(tel[:2]) <= 99:
        return False
    return len(tel) == 10 or tel[2] == "9"


def hora_valida(hora: str) -> bool:
    return bool(_HORA.match(hora))


def data_iso_estrita(valor: str) -> bool:
    return bool(_DATA_ISO.match(valor))
