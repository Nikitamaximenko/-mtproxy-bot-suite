"""Provision an inference OpenRouter API key from a management/provisioning key."""
from __future__ import annotations

import logging
import os
from pathlib import Path

import aiohttp

_log = logging.getLogger(__name__)

OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"
_DEFAULT_CACHE = Path(__file__).resolve().parent / ".openrouter_inference_key"


def _cache_path() -> Path:
    raw = (os.getenv("OPENROUTER_INFERENCE_CACHE") or "").strip()
    return Path(raw) if raw else _DEFAULT_CACHE


def _read_cache() -> str:
    p = _cache_path()
    if not p.is_file():
        return ""
    return p.read_text(encoding="utf-8").strip()


def _write_cache(key: str) -> None:
    p = _cache_path()
    p.write_text(key.strip(), encoding="utf-8")
    try:
        p.chmod(0o600)
    except OSError:
        pass


async def _auth_key_meta(session: aiohttp.ClientSession, key: str) -> dict | None:
    try:
        async with session.get(
            f"{OPENROUTER_API_BASE}/auth/key",
            headers={"Authorization": f"Bearer {key}"},
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json(content_type=None)
            if isinstance(data, dict):
                meta = data.get("data")
                return meta if isinstance(meta, dict) else None
    except Exception as e:
        _log.warning("openrouter auth/key failed: %s", e)
    return None


def _is_management_meta(meta: dict | None) -> bool:
    if not meta:
        return False
    return bool(meta.get("is_management_key") or meta.get("is_provisioning_key"))


async def _create_inference_key(session: aiohttp.ClientSession, management_key: str) -> str:
    from datetime import datetime, timezone

    name = (os.getenv("OPENROUTER_INFERENCE_KEY_NAME") or "Frosty VPN Support Bot").strip()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    payload = {"name": f"{name} {stamp}"}
    limit_raw = (os.getenv("OPENROUTER_INFERENCE_LIMIT") or "").strip()
    if limit_raw.isdigit():
        payload["limit"] = int(limit_raw)

    async with session.post(
        f"{OPENROUTER_API_BASE}/keys",
        headers={
            "Authorization": f"Bearer {management_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        raw = await resp.json(content_type=None)
        if resp.status >= 400:
            msg = ""
            if isinstance(raw, dict):
                err = raw.get("error")
                if isinstance(err, dict):
                    msg = str(err.get("message") or err)
                else:
                    msg = str(raw)[:300]
            raise RuntimeError(f"OpenRouter create key failed ({resp.status}): {msg}")

        if isinstance(raw, dict):
            key = (raw.get("key") or "").strip()
            if key.startswith("sk-or-"):
                return key
        raise RuntimeError("OpenRouter create key: missing key in response")


async def ensure_inference_key(session: aiohttp.ClientSession) -> str:
    """
    Return a key suitable for /chat/completions.

    - Regular OPENROUTER_API_KEY → use as-is.
    - Management/provisioning key (OPENROUTER_MANAGEMENT_KEY or mis-set API_KEY) →
      load cache or create a child inference key via Management API.
    """
    openai = (os.getenv("OPENAI_API_KEY") or "").strip()
    mgmt = (os.getenv("OPENROUTER_MANAGEMENT_KEY") or "").strip()
    api = (os.getenv("OPENROUTER_API_KEY") or "").strip()

    if api:
        meta = await _auth_key_meta(session, api)
        if meta and not _is_management_meta(meta):
            return api
        if meta and _is_management_meta(meta) and not mgmt:
            mgmt = api

    if not mgmt:
        return api or openai

    cached = _read_cache()
    if cached:
        meta = await _auth_key_meta(session, cached)
        if meta and not _is_management_meta(meta):
            os.environ["OPENROUTER_API_KEY"] = cached
            _log.info("openrouter: using cached inference key (label=%s)", meta.get("label", "?"))
            return cached

    _log.info("openrouter: creating inference key via management API")
    inference = await _create_inference_key(session, mgmt)
    _write_cache(inference)
    os.environ["OPENROUTER_API_KEY"] = inference
    os.environ.setdefault("OPENROUTER_MANAGEMENT_KEY", mgmt)
    _log.info("openrouter: inference key ready (len=%s)", len(inference))
    return inference
