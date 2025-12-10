"""
OAuth Manager para LinkedIn
Maneja autenticación, encriptación de tokens y almacenamiento seguro
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os
import httpx
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.models.oauth_tokens import OAuthToken

load_dotenv('.env.local')


class TokenEncryptor:
    """Encripta y desencripta tokens usando AES-256 Fernet"""
    
    def __init__(self):
        master_key = os.getenv("ANCLORA_MASTER_KEY")
        if not master_key:
            raise ValueError("ANCLORA_MASTER_KEY no está configurada en .env.local")
        
        self.cipher = Fernet(master_key.encode())
    
    def encrypt(self, token: str) -> str:
        """Encripta un token"""
        return self.cipher.encrypt(token.encode()).decode()
    
    def decrypt(self, encrypted_token: str) -> str:
        """Desencripta un token"""
        return self.cipher.decrypt(encrypted_token.encode()).decode()


class LinkedInOAuthProvider:
    """Proveedor OAuth para LinkedIn"""
    
    def __init__(self):
        self.client_id = os.getenv("LINKEDIN_CLIENT_ID")
        self.client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        self.redirect_uri = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:4173/auth/linkedin/callback")
        
        if not self.client_id or not self.client_secret:
            raise ValueError("LinkedIn credentials no están configuradas en .env.local")
        
        self.auth_url = "https://www.linkedin.com/oauth/v2/authorization"
        self.token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        self.profile_url = "https://api.linkedin.com/v2/userinfo"
    
    def get_authorization_url(self, state: str) -> str:
        """Genera URL de autorización de LinkedIn"""
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": "openid profile email w_member_social"
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.auth_url}?{query_string}"
    
    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Intercambia código de autorización por access token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                raise Exception(f"Error obteniendo token: {response.text}")
            
            return response.json()
    
    async def get_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Obtiene perfil del usuario de LinkedIn"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.profile_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                raise Exception(f"Error obteniendo perfil: {response.text}")
            
            return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresca el access token usando refresh token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                raise Exception(f"Error refrescando token: {response.text}")
            
            return response.json()


class OAuthTokenManager:
    """Gestiona el ciclo de vida de tokens OAuth en la BD"""
    
    def __init__(self, db: Session):
        self.db = db
        self.encryptor = TokenEncryptor()
    
    def save_token(
        self,
        user_id: str,
        platform: str,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_in: Optional[int] = None,
        token_type: str = "Bearer"
    ) -> OAuthToken:
        """Guarda o actualiza token en BD (encriptado)"""
        
        # Encriptar tokens
        encrypted_access = self.encryptor.encrypt(access_token)
        encrypted_refresh = self.encryptor.encrypt(refresh_token) if refresh_token else None
        
        # Calcular fecha de expiración
        expires_at = None
        if expires_in:
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Buscar token existente
        existing_token = self.db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.platform == platform
        ).first()
        
        if existing_token:
            # Actualizar token existente
            existing_token.access_token = encrypted_access
            existing_token.refresh_token = encrypted_refresh
            existing_token.token_type = token_type
            existing_token.expires_in = expires_in
            existing_token.expires_at = expires_at
            existing_token.updated_at = datetime.utcnow()
            existing_token.is_valid = True
            token = existing_token
        else:
            # Crear nuevo token
            token = OAuthToken(
                user_id=user_id,
                platform=platform,
                access_token=encrypted_access,
                refresh_token=encrypted_refresh,
                token_type=token_type,
                expires_in=expires_in,
                expires_at=expires_at,
                encrypted=True,
                is_valid=True
            )
            self.db.add(token)
        
        self.db.commit()
        self.db.refresh(token)
        return token
    
    def get_token(self, user_id: str, platform: str) -> Optional[str]:
        """Obtiene access token desencriptado desde BD"""
        token = self.db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.platform == platform,
            OAuthToken.is_valid == True
        ).first()
        
        if not token:
            return None
        
        # Verificar si expiró
        if token.expires_at and token.expires_at < datetime.utcnow():
            return None
        
        # Actualizar last_used_at
        token.last_used_at = datetime.utcnow()
        self.db.commit()
        
        # Desencriptar y retornar
        return self.encryptor.decrypt(token.access_token)
    
    def revoke_token(self, user_id: str, platform: str) -> bool:
        """Revoca (invalida) un token"""
        token = self.db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.platform == platform
        ).first()
        
        if not token:
            return False
        
        token.is_valid = False
        token.updated_at = datetime.utcnow()
        self.db.commit()
        return True
    
    def delete_token(self, user_id: str, platform: str) -> bool:
        """Elimina completamente un token (GDPR)"""
        token = self.db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.platform == platform
        ).first()
        
        if not token:
            return False
        
        self.db.delete(token)
        self.db.commit()
        return True
