"""Один AsyncAnthropic на процесс — меньше накладных расходов на TLS/пулы соединений."""

from __future__ import annotations

from anthropic import AsyncAnthropic

_cached_key: str | None = None
_client: AsyncAnthropic | None = None


def get_async_anthropic(api_key: str) -> AsyncAnthropic:
    global _cached_key, _client
    if not api_key:
        raise ValueError("api_key required")
    if _client is not None and _cached_key == api_key:
        return _client
    _client = AsyncAnthropic(api_key=api_key)
    _cached_key = api_key
    return _client
