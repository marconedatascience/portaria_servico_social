from fastapi import Header, HTTPException, status, Depends
from functools import lru_cache
from typing import Any, List, Optional
import os
import logging

try:
    from supabase import create_client
except ImportError:  # pacote opcional: sem ele, apenas a validação JWT fica indisponível
    create_client = None

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

@lru_cache(maxsize=1)
def get_supabase_client() -> Optional[Any]:
    """Cliente único reutilizado entre requisições."""
    if create_client is None:
        logger.warning("Pacote 'supabase' não instalado: validação de token JWT indisponível.")
        return None
    if SUPABASE_URL and SUPABASE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    return None

def verificar_perfil(roles_permitidas: List[str]):
    """
    Dependência de segurança RBAC para rotas do FastAPI.
    Valida token JWT via Supabase ou cabeçalho X-User-Role para isolamento multissetorial.
    """
    async def _role_verifier(
        authorization: Optional[str] = Header(None, alias="Authorization"),
        x_user_role: Optional[str] = Header(None, alias="X-User-Role")
    ) -> str:
        perfil_detectado = None

        # 1. Se vier token Bearer JWT e o Supabase estiver configurado
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            supabase = get_supabase_client()
            if supabase:
                try:
                    user_res = supabase.auth.get_user(token)
                    if user_res and user_res.user:
                        # SOMENTE app_metadata: user_metadata pode ser alterado pelo próprio usuário
                        # (supabase.auth.updateUser), o que permitiria escolher o próprio perfil.
                        metadata = user_res.user.app_metadata or {}
                        perfil = metadata.get("role") or metadata.get("setor")
                        perfil_detectado = perfil.strip().lower() if isinstance(perfil, str) and perfil.strip() else None
                except Exception:
                    logger.exception("Falha ao validar token no Supabase")

        # 2. Fallback por cabeçalho: SOMENTE em desenvolvimento (ALLOW_ROLE_HEADER=true)
        if not perfil_detectado and x_user_role and os.getenv("ALLOW_ROLE_HEADER", "false").lower() == "true":
            perfil_detectado = x_user_role.strip().lower()

        if not perfil_detectado:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Autenticação requerida ou token inválido.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        roles_normalizadas = [r.lower() for r in roles_permitidas]
        if perfil_detectado.lower() not in roles_normalizadas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: perfil sem permissão neste setor."
            )

        return perfil_detectado

    return _role_verifier
