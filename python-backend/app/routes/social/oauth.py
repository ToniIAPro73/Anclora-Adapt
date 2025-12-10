"""
Endpoints OAuth para LinkedIn
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import secrets

from app.database import get_db
from app.services.social.oauth_manager import (
    LinkedInOAuthProvider,
    OAuthTokenManager
)

router = APIRouter(prefix="/api/social/oauth", tags=["OAuth"])


# Models
class OAuthStartResponse(BaseModel):
    auth_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthCallbackResponse(BaseModel):
    success: bool
    user_id: str
    profile: dict
    message: str


class DisconnectRequest(BaseModel):
    user_id: str
    platform: str


# Endpoints
@router.post("/start/linkedin", response_model=OAuthStartResponse)
async def start_linkedin_oauth():
    """
    Inicia el flujo OAuth con LinkedIn
    Retorna URL de autorización que el frontend debe abrir
    """
    try:
        provider = LinkedInOAuthProvider()
        
        # Generar state aleatorio para prevenir CSRF
        state = secrets.token_urlsafe(32)
        
        # Obtener URL de autorización
        auth_url = provider.get_authorization_url(state)
        
        return OAuthStartResponse(
            auth_url=auth_url,
            state=state
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error iniciando OAuth: {str(e)}"
        )


@router.post("/callback", response_model=OAuthCallbackResponse)
async def oauth_callback(
    request: OAuthCallbackRequest,
    db: Session = Depends(get_db)
):
    """
    Callback de LinkedIn OAuth
    Recibe código de autorización y lo intercambia por access token
    """
    try:
        provider = LinkedInOAuthProvider()
        token_manager = OAuthTokenManager(db)
        
        # Intercambiar código por token
        token_data = await provider.exchange_code_for_token(request.code)
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se recibió access_token de LinkedIn"
            )
        
        # Obtener perfil del usuario
        profile = await provider.get_user_profile(access_token)
        
        user_id = profile.get("sub") or profile.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo obtener user_id del perfil"
            )
        
        # Guardar token en BD (encriptado)
        token_manager.save_token(
            user_id=user_id,
            platform="linkedin",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in
        )
        
        return OAuthCallbackResponse(
            success=True,
            user_id=user_id,
            profile=profile,
            message="LinkedIn conectado exitosamente"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en callback OAuth: {str(e)}"
        )


@router.post("/disconnect")
async def disconnect_platform(
    request: DisconnectRequest,
    db: Session = Depends(get_db)
):
    """
    Desconecta una plataforma social
    Revoca el token en la BD
    """
    try:
        token_manager = OAuthTokenManager(db)
        
        success = token_manager.revoke_token(
            user_id=request.user_id,
            platform=request.platform
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Token no encontrado"
            )
        
        return {
            "success": True,
            "message": f"{request.platform} desconectado exitosamente"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error desconectando: {str(e)}"
        )


@router.get("/status/{user_id}/{platform}")
async def get_connection_status(
    user_id: str,
    platform: str,
    db: Session = Depends(get_db)
):
    """
    Verifica si un usuario tiene conectada una plataforma
    """
    try:
        token_manager = OAuthTokenManager(db)
        
        token = token_manager.get_token(user_id, platform)
        
        return {
            "connected": token is not None,
            "platform": platform,
            "user_id": user_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verificando estado: {str(e)}"
        )
