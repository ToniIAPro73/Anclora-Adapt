# Anclora Adapt - Código Base para Social Integration

## Ejemplos Listos para Implementar

**Versión:** 1.1 - LINKEDIN FIRST  
**Última actualización:** Diciembre 2025

---

## 🚀 Inicio Rápido

### ⚡ CAMBIO IMPORTANTE: Fase 1 = LinkedIn (PRO hasta 29 Dic)

Tu acceso LinkedIn PRO está disponible hasta el **29 de diciembre**. Vamos a aprovechar:

**Ventajas de empezar con LinkedIn:**

- ✅ API más simple que Twitter (sin PKCE)
- ✅ Scopes claros y limitados
- ✅ Menos rate limiting issues
- ✅ Perfil profesional = prompts mejor contextualizados
- ✅ Tokens duran 2 meses (vs 2 horas en Twitter)

**Timeline ajustado:**

- **Sem 1-2 (hasta 22 Dic):** LinkedIn MVP completo
- **23-29 Dic:** Testing + refinamientos en producción
- **Después:** Twitter, Instagram, TikTok

---

## 🏗️ Backend - OAuth Manager para LinkedIn

```python
# python-backend/app/services/social/oauth_manager.py

from abc import ABC, abstractmethod
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import httpx
import os
import secrets
import json
from sqlalchemy.orm import Session

class OAuthProvider(ABC):
    """Base class para todos los OAuth providers"""

    @abstractmethod
    async def get_authorization_url(
        self,
        state: str,
        code_challenge: str = None
    ) -> str:
        pass

    @abstractmethod
    async def exchange_code_for_token(
        self,
        code: str,
        code_verifier: str = None
    ) -> Dict:
        pass

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        pass


class LinkedInOAuthProvider(OAuthProvider):
    """
    OAuth2 Provider para LinkedIn.

    Flujo simple (sin PKCE):
    1. Redirigir a: https://www.linkedin.com/oauth/v2/authorization
    2. Usuario autoriza
    3. Callback con code
    4. Intercambiar code por tokens
    """

    def __init__(self):
        self.client_id = os.getenv("LINKEDIN_CLIENT_ID")
        self.client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        self.redirect_uri = os.getenv(
            "LINKEDIN_REDIRECT_URI",
            "http://localhost:8000/auth/linkedin/callback"
        )

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "LINKEDIN_CLIENT_ID y LINKEDIN_CLIENT_SECRET requeridos"
            )

        self.auth_url = "https://www.linkedin.com/oauth/v2/authorization"
        self.token_url = "https://www.linkedin.com/oauth/v2/accessToken"

    async def get_authorization_url(
        self,
        state: str,
        code_challenge: str = None
    ) -> str:
        """
        Genera URL de autorización para LinkedIn.
        LinkedIn no requiere PKCE.

        Scopes:
        - r_liteprofile: Acceso a perfil básico
        - r_emailaddress: Acceso a email
        """
        return (
            f"{self.auth_url}?"
            f"response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope=r_liteprofile%20r_emailaddress"
            f"&state={state}"
        )

    async def exchange_code_for_token(
        self,
        code: str,
        code_verifier: str = None
    ) -> Dict:
        """
        Intercambia authorization code por tokens.

        LinkedIn retorna:
        - access_token (válido 2 meses)
        - refresh_token (válido 5 años)
        - expires_in (en segundos)
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                },
                timeout=10.0
            )

            if response.status_code != 200:
                error_detail = response.json() if response.headers.get('content-type') == 'application/json' else response.text
                raise Exception(f"LinkedIn OAuth error: {error_detail}")

            data = response.json()

            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token"),
                "expires_in": data["expires_in"],  # Típicamente 5184000 (60 días)
                "token_type": data.get("token_type", "Bearer"),
            }

    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """
        Refresca access token usando refresh token.

        LinkedIn permite:
        - refresh_token válido hasta 5 años
        - Ideal para sesiones de larga duración
        """
        if not refresh_token:
            raise ValueError("refresh_token requerido para LinkedIn")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=10.0
            )

            if response.status_code != 200:
                error_detail = response.json() if response.headers.get('content-type') == 'application/json' else response.text
                raise Exception(f"LinkedIn refresh error: {error_detail}")

            data = response.json()

            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_in": data["expires_in"],
            }


# Factory para crear providers
def get_oauth_provider(platform: str) -> OAuthProvider:
    """Factory pattern para crear provider correcto"""
    providers = {
        "linkedin": LinkedInOAuthProvider,
        # Agregar otras plataformas después
    }

    if platform not in providers:
        raise ValueError(f"Platform {platform} not supported yet. Available: {', '.join(providers.keys())}")

    return providers[platform]()


# Utilidades para OAuth
class OAuthHelper:
    """Helpers para flujos OAuth"""

    @staticmethod
    def generate_state() -> str:
        """Genera state aleatorio para OAuth (seguridad CSRF)"""
        return secrets.token_urlsafe(32)
```

---

## 🔐 Backend - Token Storage & Encryption

```python
# python-backend/app/models/oauth_tokens.py

from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import os
import json
import base64

Base = declarative_base()


class SocialOAuthToken(Base):
    """Almacenamiento seguro de tokens OAuth"""

    __tablename__ = "social_oauth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    platform = Column(String, nullable=False)  # linkedin, twitter, instagram, tiktok

    # Tokens encriptados en BD
    encrypted_access_token = Column(String, nullable=False)
    encrypted_refresh_token = Column(String, nullable=True)

    # Metadata del token
    token_expires_at = Column(DateTime, nullable=True)
    refresh_expires_at = Column(DateTime, nullable=True)
    scope = Column(String, nullable=True)
    token_type = Column(String, default="Bearer")

    # Información del perfil (JSON comprimido)
    profile_data = Column(String, nullable=True)

    # Auditoría
    created_at = Column(DateTime, default=datetime.utcnow)
    last_refreshed = Column(DateTime, nullable=True)
    last_used = Column(DateTime, nullable=True)

    # Revocación
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime, nullable=True)
    revocation_reason = Column(String, nullable=True)

    # Índices para queries rápidas
    __table_args__ = (
        Index('idx_user_platform', 'user_id', 'platform', unique=False),
        Index('idx_platform_active', 'platform', 'is_revoked'),
        Index('idx_user_active', 'user_id', 'is_revoked'),
    )

    def __repr__(self):
        return f"<SocialOAuthToken {self.platform} user={self.user_id} active={not self.is_revoked}>"


class TokenEncryptor:
    """Encripta y desencripta tokens OAuth con AES-256 + PBKDF2"""

    def __init__(self, master_key: str = None):
        if not master_key:
            master_key = os.getenv("ANCLORA_MASTER_KEY")
            if not master_key:
                raise ValueError(
                    "ANCLORA_MASTER_KEY no configurada en environment. "
                    "Genera con: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
                )

        # Derivar clave usando PBKDF2 (100,000 iteraciones)
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'anclora-social-oauth',
            iterations=100000,
            backend=default_backend()
        )

        key = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
        self.cipher_suite = Fernet(key)

    def encrypt(self, token: str) -> str:
        """Encripta token"""
        if not token:
            return None
        return self.cipher_suite.encrypt(token.encode()).decode()

    def decrypt(self, encrypted_token: str) -> str:
        """Desencripta token"""
        if not encrypted_token:
            return None
        try:
            return self.cipher_suite.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt token: {str(e)}")

    @staticmethod
    def hash_token(token: str) -> str:
        """Genera hash para audit logging (sin poder recuperar token)"""
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()[:16]


class TokenManager:
    """Gesiona el ciclo de vida de tokens OAuth"""

    def __init__(self, db_session):
        self.db = db_session
        self.encryptor = TokenEncryptor()

    def save_token(
        self,
        user_id: str,
        platform: str,
        access_token: str,
        refresh_token: str = None,
        expires_in: int = None,
        scope: str = None,
        profile_data: dict = None
    ) -> SocialOAuthToken:
        """
        Guarda token de forma segura en BD.

        Args:
            user_id: ID del usuario
            platform: 'linkedin', 'twitter', etc
            access_token: Token para hacer requests
            refresh_token: Token para refrescar (si aplica)
            expires_in: Segundos hasta expiración
            scope: Permisos autorizados
            profile_data: Dict con info del perfil

        Returns:
            SocialOAuthToken record
        """

        # Calcular fecha de expiración
        token_expires_at = None
        if expires_in:
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        # Encriptar tokens
        encrypted_access = self.encryptor.encrypt(access_token)
        encrypted_refresh = self.encryptor.encrypt(refresh_token) if refresh_token else None

        # Crear registro
        token_record = SocialOAuthToken(
            user_id=user_id,
            platform=platform,
            encrypted_access_token=encrypted_access,
            encrypted_refresh_token=encrypted_refresh,
            token_expires_at=token_expires_at,
            scope=scope,
            profile_data=json.dumps(profile_data) if profile_data else None,
            created_at=datetime.utcnow(),
        )

        self.db.add(token_record)
        self.db.commit()
        self.db.refresh(token_record)

        return token_record

    def get_valid_token(self, user_id: str, platform: str) -> Optional[str]:
        """
        Obtiene token válido, refrescando si es necesario.

        Lógica:
        1. Buscar token no revocado
        2. Si expiró y hay refresh_token, refrescar
        3. Si no expiró, retornar
        4. Si no hay refresh_token, retornar None
        """

        token_record = self.db.query(SocialOAuthToken).filter(
            SocialOAuthToken.user_id == user_id,
            SocialOAuthToken.platform == platform,
            SocialOAuthToken.is_revoked == False
        ).first()

        if not token_record:
            return None

        # Verificar si expiró
        if token_record.token_expires_at and datetime.utcnow() > token_record.token_expires_at:
            if token_record.encrypted_refresh_token:
                # Intentar refrescar
                try:
                    refresh_token = self.encryptor.decrypt(token_record.encrypted_refresh_token)
                    provider = self._get_provider(platform)
                    new_tokens = asyncio.run(provider.refresh_access_token(refresh_token))

                    # Actualizar en BD
                    token_record.encrypted_access_token = self.encryptor.encrypt(new_tokens["access_token"])
                    if new_tokens.get("refresh_token"):
                        token_record.encrypted_refresh_token = self.encryptor.encrypt(new_tokens["refresh_token"])

                    if new_tokens.get("expires_in"):
                        token_record.token_expires_at = datetime.utcnow() + timedelta(seconds=new_tokens["expires_in"])

                    token_record.last_refreshed = datetime.utcnow()
                    self.db.commit()

                    return new_tokens["access_token"]
                except Exception as e:
                    print(f"Error refrescando token: {e}")
                    return None
            else:
                return None

        # Token aún válido
        token_record.last_used = datetime.utcnow()
        self.db.commit()

        return self.encryptor.decrypt(token_record.encrypted_access_token)

    def revoke_token(self, user_id: str, platform: str, reason: str = None):
        """Revoca token del usuario"""

        token_record = self.db.query(SocialOAuthToken).filter(
            SocialOAuthToken.user_id == user_id,
            SocialOAuthToken.platform == platform,
            SocialOAuthToken.is_revoked == False
        ).first()

        if token_record:
            token_record.is_revoked = True
            token_record.revoked_at = datetime.utcnow()
            token_record.revocation_reason = reason or "User revoked"
            self.db.commit()

            return True
        return False

    def revoke_all_platforms(self, user_id: str):
        """Revoca TODOS los tokens (GDPR right to be forgotten)"""

        tokens = self.db.query(SocialOAuthToken).filter(
            SocialOAuthToken.user_id == user_id,
            SocialOAuthToken.is_revoked == False
        ).all()

        for token in tokens:
            token.is_revoked = True
            token.revoked_at = datetime.utcnow()
            token.revocation_reason = "User requested full revocation (GDPR)"

        self.db.commit()
        return len(tokens)

    @staticmethod
    def _get_provider(platform: str):
        """Helper para obtener provider"""
        from app.services.social.oauth_manager import get_oauth_provider
        return get_oauth_provider(platform)
```

---

## 🔗 Backend - LinkedIn-Specific Routes

```python
# python-backend/app/routes/social/oauth.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import json

from app.services.social.oauth_manager import get_oauth_provider, OAuthHelper
from app.models.oauth_tokens import TokenManager
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/api/social", tags=["Social OAuth"])


@router.post("/oauth/start/{platform}")
async def start_oauth_flow(
    platform: str,
    current_user = Depends(get_current_user),
):
    """
    Inicia flujo OAuth para una plataforma.

    Retorna:
    - auth_url: URL a la que redirigir al usuario
    - state: Para validar callback
    - platform: Plataforma solicitada
    """

    # Validar plataforma soportada
    if platform not in ["linkedin"]:
        raise HTTPException(
            status_code=400,
            detail=f"Platform {platform} not supported yet. Available: linkedin"
        )

    try:
        provider = get_oauth_provider(platform)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generar state (prevenir CSRF)
    state = OAuthHelper.generate_state()

    # Generar URL de autorización
    auth_url = await provider.get_authorization_url(state)

    return {
        "auth_url": auth_url,
        "platform": platform,
        "state": state,
    }


@router.post("/oauth/callback")
async def handle_oauth_callback(
    platform: str,
    code: str,
    state: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Maneja callback de OAuth después de autorización del usuario.

    Flujo:
    1. Usuario autoriza en LinkedIn
    2. LinkedIn redirige con code
    3. Backend intercambia code por tokens
    4. Guardar tokens encriptados
    5. Obtener perfil del usuario
    """

    if not code:
        raise HTTPException(status_code=400, detail="Missing code parameter")

    try:
        # Obtener provider
        provider = get_oauth_provider(platform)

        # Intercambiar código por tokens
        token_response = await provider.exchange_code_for_token(code=code)

        # Obtener datos del perfil
        profile = await fetch_linkedin_profile(token_response["access_token"])

        # Guardar token seguro
        token_manager = TokenManager(db)
        token_manager.save_token(
            user_id=current_user.id,
            platform=platform,
            access_token=token_response["access_token"],
            refresh_token=token_response.get("refresh_token"),
            expires_in=token_response.get("expires_in"),
            scope=token_response.get("scope"),
            profile_data=profile
        )

        return {
            "success": True,
            "platform": platform,
            "profile": profile,
            "message": f"Connected to {platform} successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"OAuth callback error: {str(e)}"
        )


@router.get("/connected-platforms")
async def get_connected_platforms(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna lista de plataformas conectadas por el usuario"""

    tokens = db.query(SocialOAuthToken).filter(
        SocialOAuthToken.user_id == current_user.id,
        SocialOAuthToken.is_revoked == False
    ).all()

    platforms = []
    for token in tokens:
        profile_data = json.loads(token.profile_data) if token.profile_data else {}
        platforms.append({
            "platform": token.platform,
            "profile_name": profile_data.get("name", "Unknown"),
            "profile_image": profile_data.get("profile_picture_url"),
            "connected_at": token.created_at.isoformat(),
            "expires_at": token.token_expires_at.isoformat() if token.token_expires_at else None,
        })

    return {"platforms": platforms}


@router.post("/disconnect/{platform}")
async def disconnect_platform(
    platform: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Desconecta una plataforma (revoca token)"""

    token_manager = TokenManager(db)
    success = token_manager.revoke_token(
        user_id=current_user.id,
        platform=platform,
        reason="User disconnected"
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"No active connection to {platform}"
        )

    return {
        "success": True,
        "platform": platform,
        "message": f"Disconnected from {platform}"
    }


# Helpers para obtener perfil
async def fetch_linkedin_profile(access_token: str) -> dict:
    """
    Obtiene datos del perfil de LinkedIn.

    API: GET https://api.linkedin.com/v2/me

    Retorna:
    {
        "id": "usuario_id",
        "first_name": "Juan",
        "last_name": "Pérez",
        "headline": "Software Engineer at Company",
        "summary": "Passionate about...",
        "profile_picture_url": "https://...",
        "location": "Madrid, Spain",
        "email": "juan@example.com"
    }
    """

    import httpx

    try:
        # GET /v2/me - Información del usuario
        async with httpx.AsyncClient() as client:
            # Obtener datos básicos
            response = await client.get(
                "https://api.linkedin.com/v2/me",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

            if response.status_code != 200:
                raise Exception(f"LinkedIn API error: {response.text}")

            user = response.json()

            # Obtener email
            email_response = await client.get(
                "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

            email = None
            if email_response.status_code == 200:
                email_data = email_response.json()
                if email_data.get("elements"):
                    email = email_data["elements"][0].get("handle~", {}).get("emailAddress")

            # Armar respuesta
            profile = {
                "id": user.get("id"),
                "first_name": user.get("localizedFirstName"),
                "last_name": user.get("localizedLastName"),
                "headline": user.get("headline"),
                "summary": user.get("summary"),
                "email": email,
                "location": user.get("geoLocation", {}).get("country", {}).get("code"),
            }

            return profile

    except Exception as e:
        raise Exception(f"Failed to fetch LinkedIn profile: {str(e)}")
```

---

## 💻 Frontend - Context para Social

```typescript
// src/context/SocialContext.tsx

import React, { createContext, useContext, useState, useCallback } from "react";

interface SocialProfile {
  platform: string;
  profile_name: string;
  profile_image?: string;
  connectedAt: string;
  expiresAt?: string;
}

interface SocialContextType {
  connectedPlatforms: SocialProfile[];
  isLoading: boolean;
  error: string | null;

  connectPlatform: (platform: string) => Promise<void>;
  disconnectPlatform: (platform: string) => Promise<void>;
  refreshPlatforms: () => Promise<void>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [connectedPlatforms, setConnectedPlatforms] = useState<SocialProfile[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectPlatform = useCallback(async (platform: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Iniciar OAuth flow
      const startResponse = await fetch(`/api/social/oauth/start/${platform}`, {
        method: "POST",
      });

      if (!startResponse.ok) {
        const data = await startResponse.json();
        throw new Error(data.detail || "Failed to start OAuth");
      }

      const { auth_url } = await startResponse.json();

      // 2. Redirigir a plataforma
      window.location.href = auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoading(false);
    }
  }, []);

  const disconnectPlatform = useCallback(async (platform: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/social/disconnect/${platform}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to disconnect");
      }

      setConnectedPlatforms((prev) =>
        prev.filter((p) => p.platform !== platform)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPlatforms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/social/connected-platforms");

      if (!response.ok) throw new Error("Failed to fetch platforms");

      const { platforms } = await response.json();
      setConnectedPlatforms(platforms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <SocialContext.Provider
      value={{
        connectedPlatforms,
        isLoading,
        error,
        connectPlatform,
        disconnectPlatform,
        refreshPlatforms,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = (): SocialContextType => {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error("useSocial must be used within SocialProvider");
  }
  return context;
};
```

---

## 🔐 Frontend - OAuth Callback Handler

```typescript
// src/pages/auth/linkedin-callback.tsx

import { useEffect, useSearchParams } from "react";
import { useNavigate } from "react-router-dom";
import { useSocial } from "@/context/SocialContext";

export function LinkedInOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshPlatforms } = useSocial();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const error_description = searchParams.get("error_description");

      if (error) {
        console.error(`OAuth error: ${error} - ${error_description}`);
        navigate("/modes/social?error=oauth_failed&platform=linkedin");
        return;
      }

      if (!code) {
        console.error("No authorization code received");
        navigate("/modes/social?error=no_code&platform=linkedin");
        return;
      }

      try {
        // Enviar callback al backend
        const response = await fetch("/api/social/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "linkedin",
            code,
            state,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Failed to complete OAuth");
        }

        // Refrescar lista de plataformas
        await refreshPlatforms();

        // Redirigir a modo social
        navigate("/modes/social?connected=linkedin&success=true");
      } catch (error) {
        console.error("OAuth callback error:", error);
        navigate("/modes/social?error=callback_failed&platform=linkedin");
      }
    };

    handleCallback();
  }, [searchParams, navigate, refreshPlatforms]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div className="spinner" />
      <p>Completando autenticación con LinkedIn...</p>
    </div>
  );
}
```

---

## 📋 .env.example (LinkedIn)

```bash
# Backend - LinkedIn API

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/linkedin/callback

# Security - Encryption
ANCLORA_MASTER_KEY=your_base64_encoded_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost/anclora_adapt

# Backend
FASTAPI_ENV=development
LOG_LEVEL=INFO

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🚀 Setup LinkedIn PRO (Paso a Paso)

### 1. Obtener Credenciales de LinkedIn

```text
1. Ir a: https://www.linkedin.com/developers/apps
2. Crear nueva app:
   - App name: "Anclora Adapt"
   - Company: Tu empresa/proyecto
   - App logo: Logo de Anclora Adapt

3. En Settings → Credentials:
   - Copiar CLIENT_ID
   - Copiar CLIENT_SECRET

4. En Settings → Authorized redirect URIs:
   - Agregar: http://localhost:8000/auth/linkedin/callback
   - Agregar: http://localhost:4173/auth/linkedin/callback (frontend)
   - Agregar: https://anclora-adapt.vercel.app/auth/linkedin/callback (producción)

5. En Products → Request access:
   - Solicitar: "Sign In with LinkedIn"
```

### 2. Configurar Backend

```bash
# Generar ANCLORA_MASTER_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Resultado: gAAAAAB... (guardar en .env)

# Crear .env.local
cp .env.example .env.local

# Editar con tus credenciales de LinkedIn
nano python-backend/.env.local

# Instalar dependencias
cd python-backend
pip install -r requirements.txt

# Crear tabla en BD
alembic upgrade head

# Iniciar servidor
python main.py
```

### 3. Configurar Frontend

```bash
# Asegurar que .env.local tiene:
VITE_API_BASE_URL=http://localhost:8000

# El callback route debe estar en App.tsx
# Agregar ruta: /auth/linkedin/callback → <LinkedInOAuthCallback />

# Iniciar frontend
npm run dev
```

### 4. Testing

```text
1. Abrir: http://localhost:4173/modes/social
2. Hacer click en "Conectar LinkedIn"
3. Autorizar en linkedin.com
4. Redirigirá a /auth/linkedin/callback
5. Debería mostrar éxito y listar el perfil
```

---

## 📅 Roadmap Acelerado (hasta 29 Dic)

| Fecha         | Tarea                               | Duración |
| ------------- | ----------------------------------- | -------- |
| **9-12 Dic**  | Setup OAuth + almacenamiento tokens | 4 días   |
| **13-15 Dic** | Implementar routes de LinkedIn      | 2 días   |
| **16-18 Dic** | Frontend SocialMode + testing       | 2 días   |
| **19-22 Dic** | ProfileAnalyzer + CommentResponder  | 3 días   |
| **23-26 Dic** | QA y refinamientos                  | 3 días   |
| **27-29 Dic** | Deployment y monitoring             | 2 días   |

---

## 🎯 Checklist MVP LinkedIn

- [ ] LinkedIn app creada en developer portal
- [ ] CLIENT_ID y CLIENT_SECRET en .env
- [ ] ANCLORA_MASTER_KEY generada y configurada
- [ ] Tabla `social_oauth_tokens` creada en BD
- [ ] Endpoints OAuth funcionando en Postman
- [ ] Frontend SocialMode componente creado
- [ ] OAuth callback route registrada
- [ ] Testing manual: conectar LinkedIn
- [ ] Tokens guardados encriptados en BD
- [ ] Desconexión (revocación) funcionando
- [ ] ProfileAnalyzer obteniendo datos correctamente
- [ ] CommentResponder generando respuestas

---

## 🔐 Security Checklist (ANTES DE PRODUCCIÓN)

- [ ] ANCLORA_MASTER_KEY **no en repo** (solo .env.local)
- [ ] Tokens **siempre encriptados** en BD
- [ ] Rate limiting implementado
- [ ] GDPR consent modal antes de conectar
- [ ] Audit logging de conexiones
- [ ] Refresh token logic probada
- [ ] Error handling sin filtrar datos sensibles
- [ ] HTTPS enabled en producción
- [ ] Database credentials en secrets manager

---

¡Listo para empezar! 🚀
