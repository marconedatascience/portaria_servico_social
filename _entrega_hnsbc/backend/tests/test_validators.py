from __future__ import annotations

import pytest

from core.validators import cns_valido, telefone_valido


@pytest.mark.parametrize(
    "cns",
    [
        "800000000000001",  # provisório
        "700000000000005",  # provisório
        "100000000000007",  # definitivo (DV 0 -> soma%11)
        "100000010000018",  # definitivo com DV = 10 (caso especial 001)
    ],
)
def test_cns_validos(cns: str) -> None:
    assert cns_valido(cns)


@pytest.mark.parametrize(
    "cns",
    [
        "800000000000002",  # DV errado
        "100000000000008",  # DV errado
        "300000000000001",  # inicial inválida
        "80000000000000",  # 14 dígitos
        "8000000000000011",  # 16 dígitos
        "80000000000000a",  # não numérico
        "",
    ],
)
def test_cns_invalidos(cns: str) -> None:
    assert not cns_valido(cns)


@pytest.mark.parametrize("tel", ["8230001234", "82998765432", "11912345678", "99912345678"])
def test_telefones_validos(tel: str) -> None:
    assert telefone_valido(tel)


@pytest.mark.parametrize(
    "tel",
    ["82898765432", "10998765432", "0899876543", "829987654321", "82998765", "(82) 99876-5432", ""],
)
def test_telefones_invalidos(tel: str) -> None:
    assert not telefone_valido(tel)
