"""Рендер PDF из HTML через Chromium (тот же визуал, что в браузере)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def html_to_pdf_bytes(html: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError("playwright не установлен: pip install playwright && playwright install chromium") from e

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
        )
        try:
            page = browser.new_page()
            page.set_default_timeout(60_000)
            page.set_content(html, wait_until="load")
            try:
                page.wait_for_load_state("networkidle", timeout=15_000)
            except Exception:
                pass
            # Поля задаются в HTML (@page); иначе Chromium дублирует отступы и сужает колонки.
            pdf = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                prefer_css_page_size=True,
            )
            return bytes(pdf)
        finally:
            browser.close()
