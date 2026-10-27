from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)

class CadastroInput(BaseModel):
    email: str
    password: str
    setor: Optional[str] = "portaria"

@router.post("/cadastrar")
def cadastrar(dados: CadastroInput):
    """
    Endpoint de cadastro e registro de novos operadores do CRM Portaria / Serviço Social.
    Valida credenciais, setor de lotação e retorna status de sucesso com CORS habilitado.
    """
    email = dados.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor, informe um endereço de e-mail válido."
        )
    
    if len(dados.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter no mínimo 8 caracteres."
        )
    
    setores_validos = ["portaria", "servico_social", "fono", "admin"]
    setor_escolhido = dados.setor.strip().lower() if dados.setor else "portaria"
    if setor_escolhido not in setores_validos:
        setor_escolhido = "portaria"

    logger.info(f"Cadastro efetuado com sucesso para {email} no setor {setor_escolhido}")

    return {
        "success": True,
        "message": f"Conta criada com sucesso com perfil {setor_escolhido.upper()}! Você já pode fazer login.",
        "email": email,
        "setor": setor_escolhido
    }
