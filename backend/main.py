import os

try:
    from dotenv import load_dotenv
    load_dotenv()  # precisa rodar antes de importar routers/core (que leem os.getenv)
except ImportError:
    pass  # sem python-dotenv: use `uvicorn main:app --env-file .env`

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import pacientes, regras, auth

app = FastAPI(
    title="CRM Portaria HNSBC API",
    description="API para gestão de relacionamento e acesso de visitantes do Hospital",
    version="1.0.0"
)

# Configuração de CORS para permitir o frontend Next.js (Inclusão Digital no Tablet)
origens_env = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
# Garante que http://localhost:3000 e http://127.0.0.1:3000 sempre estejam nas origens permitidas
origens_permitidas = list(dict.fromkeys(origens_env + ["http://localhost:3000", "http://127.0.0.1:3000"]))

cors_kwargs = {
    "allow_origins": origens_permitidas,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
cors_regex = os.getenv("CORS_ORIGIN_REGEX")
if cors_regex:
    cors_kwargs["allow_origin_regex"] = cors_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do CRM Portaria HNSBC - Foco em Triagem Humanizada"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(pacientes.router, prefix="/api/v1/pacientes", tags=["pacientes"])
app.include_router(regras.router, prefix="/api/v1/regras", tags=["regras"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

