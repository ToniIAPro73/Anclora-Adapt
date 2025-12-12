"""
Global configuration helpers for the Python backend.

Centralizes how we obtain runtime settings such as the Ollama URL so that
containers, local dev servers and Docker Desktop all respect the same source.
"""

from __future__ import annotations

import os

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"


def _normalize_base_url(value: str | None) -> str:
    """Return a sanitized base URL without trailing slash."""
    base = (value or DEFAULT_OLLAMA_BASE_URL).strip()
    # Remove trailing slash to avoid duplications when building endpoints
    return base[:-1] if base.endswith("/") else base


def resolve_ollama_base_url() -> str:
    """
    Determine the Ollama base URL using env vars with sensible fallbacks.

    Priority:
    1. OLLAMA_BASE_URL (explicit backend override)
    2. VITE_OLLAMA_BASE_URL (shared var used in dev configs)
    3. DEFAULT_OLLAMA_BASE_URL (localhost)
    """
    env_candidates = ("OLLAMA_BASE_URL", "VITE_OLLAMA_BASE_URL")
    for key in env_candidates:
        raw_value = os.getenv(key)
        if raw_value:
            return _normalize_base_url(raw_value)
    return _normalize_base_url(None)


OLLAMA_BASE_URL = resolve_ollama_base_url()
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"
