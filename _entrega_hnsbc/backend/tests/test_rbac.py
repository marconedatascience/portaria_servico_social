"""RBAC: matriz vinda de config_fluxos; negado por padrão; fallback seguro."""
from __future__ import annotations

from uuid import uuid4

from tests.conftest import como
from tests.fakes import CNS_VALIDO, FakeSource

AGENDA = "/api/v1/orelhinha/agenda/1"
DEMO = "/api/v1/orelhinha/agenda/1/demografico"
IF1 = {"If-Match": '"1"'}


async def test_portaria_nao_altera_data_hora_403(client, repo):
    for perfil in ("portaria", "servico_social"):
        r = await client.patch(
            AGENDA, json={"data_exame": "2026-10-29", "horario": "10:00"}, headers=como(perfil, **IF1)
        )
        assert r.status_code == 403, perfil
    assert repo.escritas == 0


async def test_403_vem_antes_da_validacao_do_corpo(client):
    r = await client.patch(AGENDA, json={"horario": "99:99"}, headers=como("portaria", **IF1))
    assert r.status_code == 403  # não vaza 422 para quem não tem permissão


async def test_fono_altera_data_hora(client, repo):
    r = await client.patch(
        AGENDA, json={"data_exame": "2026-10-29", "horario": "10:30"}, headers=como("fono", **IF1)
    )
    assert r.status_code == 200
    corpo = r.json()
    assert (corpo["data_exame"], corpo["horario"], corpo["versao"]) == ("2026-10-29", "10:30", 2)
    assert r.headers["etag"] == '"2"'


async def test_fono_nao_altera_demografico(client):
    r = await client.patch(
        DEMO, json={"municipio": "Craíbas", "operation_id": str(uuid4())}, headers=como("fono", **IF1)
    )
    assert r.status_code == 403


async def test_portaria_altera_demografico(client, repo):
    r = await client.patch(
        DEMO,
        json={"municipio": "Craíbas", "telefone": "82987123456", "operation_id": str(uuid4())},
        headers=como("portaria", **IF1),
    )
    assert r.status_code == 200
    assert repo.dados[1]["municipio"] == "Craíbas"
    assert repo.dados[1]["telefone"] == "82987123456"  # salvo sem máscara


async def test_extra_forbid_data_no_demografico(client):
    r = await client.patch(
        DEMO,
        json={"municipio": "Craíbas", "data_exame": "2026-10-29", "operation_id": str(uuid4())},
        headers=como("portaria", **IF1),
    )
    assert r.status_code == 422


async def test_nascimento_e_sexo_somente_leitura(client):
    for campo, valor in (("data_nascimento", "2026-10-21"), ("sexo", "M")):
        r = await client.patch(
            DEMO, json={campo: valor, "operation_id": str(uuid4())}, headers=como("portaria", **IF1)
        )
        assert r.status_code == 422, campo


async def test_perfil_nao_listado_e_negado_por_padrao(client):
    r = await client.patch(
        DEMO, json={"municipio": "Craíbas", "operation_id": str(uuid4())}, headers=como("admin", **IF1)
    )
    assert r.status_code == 403


async def test_config_indisponivel_nega(app, client, source):
    source.falhar = True
    r = await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))
    assert r.status_code == 403
    r = await client.patch(AGENDA, json={"horario": "10:00"}, headers=como("fono", **IF1))
    assert r.status_code == 403


async def test_sem_autenticacao_401(client):
    assert (await client.get("/api/v1/orelhinha/agenda")).status_code == 401


async def test_front_recebe_permissoes_do_servidor(client):
    r = await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))
    assert r.json()["permissoes_campos"] == ["data_exame", "horario"]
    r = await client.get("/api/v1/orelhinha/permissoes", headers=como("portaria"))
    assert r.json()["permissoes_campos"] == ["cartao_sus", "municipio", "nome_mae", "telefone"]


async def test_pii_oculta_para_quem_nao_edita(client):
    fono = (await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))).json()["itens"][0]
    portaria = (await client.get("/api/v1/orelhinha/agenda", headers=como("portaria"))).json()["itens"][0]
    assert fono["cartao_sus"] == "***********0001" and fono["telefone"].endswith("5432")
    assert fono["cartao_sus"] != CNS_VALIDO
    assert portaria["cartao_sus"] == CNS_VALIDO


async def test_cache_de_config_com_ttl_e_invalidacao(app, client, source, cache):
    await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))
    await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))
    assert source.leituras == 1  # segunda leitura veio do cache
    await app.state.orelhinha_service._config.invalidar()
    await client.get("/api/v1/orelhinha/agenda", headers=como("fono"))
    assert source.leituras == 2


async def test_validacoes_de_negocio_vem_de_config(client):
    h = como("fono", **IF1)
    r = await client.patch(AGENDA, json={"data_exame": "2026-10-20"}, headers=h)  # além da retroatividade
    assert r.status_code == 422
    r = await client.patch(AGENDA, json={"horario": "22:00"}, headers=h)  # fora da janela
    assert r.status_code == 422
    r = await client.patch(AGENDA, json={"data_exame": "2026-02-31"}, headers=h)  # calendário inválido
    assert r.status_code == 422
    r = await client.patch(AGENDA, json={"data_exame": "28/10/2026"}, headers=h)  # só ISO
    assert r.status_code == 422


async def test_cns_invalido_422(client):
    r = await client.patch(
        DEMO, json={"cartao_sus": "800000000000002", "operation_id": str(uuid4())}, headers=como("portaria", **IF1)
    )
    assert r.status_code == 422
