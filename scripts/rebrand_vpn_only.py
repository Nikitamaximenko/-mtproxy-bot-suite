#!/usr/bin/env python3
"""Replace user-facing MTProxy copy with VPN-only positioning."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Files/dirs to process (user-facing text)
GLOBS = [
    "frontend/app/**/*.ts",
    "frontend/app/**/*.tsx",
    "frontend/components/**/*.tsx",
    "frontend/lib/**/*.ts",
    "backend/campaign_engine.py",
    "backend/main.py",
    "bot/support_ai.py",
    "bot/main.py",
    "README.md",
]

SKIP_PARTS = {
    "node_modules",
    ".next",
    "dist",
    "design-preview",
}

REPLACEMENTS: list[tuple[str, str]] = [
    ("MTProxy + VPN", "VPN"),
    ("MTProxy и VPN", "VPN"),
    ("MTProxy для Telegram", "VPN"),
    ("MTProxy внутри Telegram", "VPN через Happ"),
    ("MTProxy ускоряет", "VPN помогает"),
    ("нужен MTProxy или VPN", "нужен VPN"),
    ("Личный MTProxy", "Личный VPN"),
    ("личный MTProxy", "личный VPN"),
    ("Персональный MTProxy", "Персональный VPN"),
    ("персональный MTProxy", "персональный VPN"),
    ("2 в 1» — MTProxy", "VPN"),
    ("2 в 1 — MTProxy", "VPN"),
    ("Прокси + VPN", "VPN"),
    ("прокси + VPN", "VPN"),
    ("MTProxy", "VPN"),
    ('"mtproxy"', '"vpn"'),
    ("mtproxy telegram", "vpn telegram"),
    ("telegram-kazan-mtproxy", "telegram-kazan-vpn"),
    ("gaid-proverka-skorosti-mtproxy", "gaid-proverka-skorosti-vpn"),
]


def should_skip(path: Path) -> bool:
    return any(p in path.parts for p in SKIP_PARTS)


def transform(text: str) -> str:
    out = text
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    # FAQ / marketing: «прокси и VPN» → VPN
    out = re.sub(r"прокси и VPN", "VPN", out, flags=re.I)
    out = re.sub(r"прокси\s*\+\s*VPN", "VPN", out, flags=re.I)
    out = re.sub(r"прокси для Telegram", "VPN для Telegram", out, flags=re.I)
    out = re.sub(r"Прокси Telegram", "VPN", out)
    out = re.sub(r"Подключить прокси", "Подключить VPN", out)
    out = re.sub(r"«2 в 1 — Прокси \+ VPN»", "«Оформить VPN»", out)
    out = re.sub(r"«2 в 1 — VPN \+ VPN»", "«Оформить VPN»", out)
    return out


def main() -> int:
    changed = 0
    for pattern in GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file() or should_skip(path):
                continue
            raw = path.read_text(encoding="utf-8")
            new = transform(raw)
            if new != raw:
                path.write_text(new, encoding="utf-8")
                print(f"updated: {path.relative_to(ROOT)}")
                changed += 1
    print(f"done, {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
