"""Sincronização: lock otimista (409) e idempotência por operation_id."""
from __future__ import annotations

from uuid import uuid4

from tests.conftest import como

AGENDA = "/api/v1/orelhinha/agenda/1"
DEMO = "/api/v1/orelhinha/agenda/1/demografico"


async def test_versao_obrigatoria_428(client):
    r = await client.patch(AGENDA, json={"horario": "10:00"}, headers=como("fono"))
    assert r.status_code == 428


async def test_conflito_409_devolve_estado_atual(client, repo):
    h1 = como("fono", **{"If-Match": '"1"'})
    assert (await client.patch(AGENDA, json={"horario": "10:00"}, headers=h1)).status_code == 200
    # segundo cliente ainda com versão 1
    r = await client.patch(AGENDA, json={"horario": "11:00"}, headers=h1)
    assert r.status_code == 409
    detalhe = r.json()["detail"]
    assert detalhe["codigo"] == "conflito_versao"
    assert detalhe["atual"]["versao"] == 2 and detalhe["atual"]["horario"] == "10:00"
    assert repo.dados[1]["horario"] == "10:00"


async def test_conflito_409_nao_vaza_pii(client):
    await client.patch(AGENDA, json={"horario": "10:00"}, headers=como("fono", **{"If-Match": '"1"'}))
    r = await client.patch(AGENDA, json={"horario": "11:00"}, headers=como("fono", **{"If-Match": '"1"'}))
    assert r.json()["detail"]["atual"]["cartao_sus"].startswith("*")


async def test_idempotencia_operation_id(client, repo):
    op = str(uuid4())
    h = como("portaria", **{"If-Match": '"1"'})
    corpo = {"municipio": "Craíbas", "operation_id": op}
    r1 = await client.patch(DEMO, json=corpo, headers=h)
    r2 = await client.patch(DEMO, json=corpo, headers=h)  # retry do cliente offline
    assert r1.status_code == r2.status_code == 200
    assert r2.headers.get("idempotent-replay") == "true"
    assert "idempotent-replay" not in r1.headers
    assert r1.json()["versao"] == r2.json()["versao"] == 2
    assert repo.escritas == 1  # sem duplicar


async def test_replay_vence_conflito_de_versao(client, repo):
    op = str(uuid4())
    corpo = {"municipio": "Craíbas", "operation_id": op}
    h = como("portaria", **{"If-Match": '"1"'})
    assert (await client.patch(DEMO, json=corpo, headers=h)).status_code == 200
    # Fono muda a agenda -> versão 3; o retry com versão antiga e o mesmo operation_id NÃO deve virar 409
    await client.patch(AGENDA, json={"horario": "10:00"}, headers=como("fono", **{"If-Match": '"2"'}))
    r = await client.patch(DEMO, json=corpo, headers=h)
    assert r.status_code == 200 and r.headers.get("idempotent-replay") == "true"
    assert repo.escritas == 2


async def test_operation_ids_distintos_sao_operacoes_distintas(client, repo):
    h = como("portaria", **{"If-Match": '"1"'})
    await client.patch(DEMO, json={"municipio": "Craíbas", "operation_id": str(uuid4())}, headers=h)
    r = await client.patch(DEMO, json={"municipio": "Girau", "operation_id": str(uuid4())}, headers=h)
    assert r.status_code == 409  # mesma versão antiga, operação nova => conflito legítimo


async def test_operation_id_obrigatorio_no_demografico(client):
    r = await client.patch(
        DEMO, json={"municipio": "Craíbas"}, headers=como("portaria", **{"If-Match": '"1"'})
    )
    assert r.status_code == 422


async def test_registro_inexistente_404(client):
    r = await client.patch(
        "/api/v1/orelhinha/agenda/999", json={"horario": "10:00"}, headers=como("fono", **{"If-Match": '"1"'})
    )
    assert r.status_code == 404
