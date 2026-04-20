from __future__ import annotations

import io
import os
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

_FONT_REGISTERED = False


def _register_cyrillic_fonts() -> str:
    """Регистрирует DejaVu Sans из app/fonts (кириллица). Возвращает имя шрифта для ParagraphStyle."""
    global _FONT_REGISTERED
    font_name = "DejaVuSans"
    if _FONT_REGISTERED:
        return font_name
    here = os.path.dirname(os.path.abspath(__file__))
    ttf = os.path.join(here, "fonts", "DejaVuSans.ttf")
    if not os.path.isfile(ttf):
        raise FileNotFoundError(
            f"Нет файла шрифта {ttf}. Добавьте DejaVuSans.ttf (см. app/fonts/README.md).",
        )
    pdfmetrics.registerFont(TTFont(font_name, ttf))
    # Жирный через тот же файл — иначе <b> в Paragraph ломает кириллицу
    pdfmetrics.registerFont(TTFont(f"{font_name}-Bold", ttf))
    from reportlab.lib.fonts import addMapping

    addMapping(font_name, 0, 0, font_name)
    addMapping(font_name, 1, 0, f"{font_name}-Bold")
    _FONT_REGISTERED = True
    return font_name


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def _esc(s: str) -> str:
    return escape(s or "")


def build_pdf_bytes(report: dict[str, Any], dilemma: str) -> bytes:
    """PDF A4: светлый фон, кириллица через DejaVu Sans."""
    fn = _register_cyrillic_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    cream = colors.HexColor("#FAF7F0")
    accent = colors.HexColor("#6B7F2A")
    ink = colors.HexColor("#1a1a1d")
    body_color = colors.HexColor("#2d2d33")
    muted = colors.HexColor("#5c5c66")

    title = ParagraphStyle(
        name="PdfTitle",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=20,
        leading=26,
        textColor=ink,
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        name="PdfH2",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=14,
        leading=20,
        textColor=ink,
        spaceAfter=8,
        spaceBefore=6,
    )
    body = ParagraphStyle(
        name="PdfBody",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=10,
        leading=14,
        textColor=body_color,
    )
    meta = ParagraphStyle(
        name="PdfMeta",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=8,
        leading=11,
        textColor=muted,
    )

    story: list[Any] = []
    story.append(_p("<b>ЛОГИКА.</b> Анализ решения", title))
    story.append(Spacer(1, 0.35 * cm))

    score = report.get("overall_score", 0)
    story.append(_p(f"<b>Оценка:</b> {score} / 100", body))
    story.append(_p(f"<i>{_esc(str(report.get('verdict_short', '') or ''))}</i>", body))
    story.append(Spacer(1, 0.45 * cm))

    story.append(_p("<b>Дилемма</b>", h2))
    story.append(_p(_esc(dilemma), body))
    story.append(Spacer(1, 0.35 * cm))

    story.append(_p("<b>Итог</b>", h2))
    summary = str(report.get("summary") or "")
    for para in summary.split("\n\n"):
        if para.strip():
            story.append(_p(_esc(para.strip()), body))
    story.append(Spacer(1, 0.35 * cm))

    story.append(_p("<b>Законы логики</b>", h2))
    for law in report.get("laws") or []:
        name = _esc(str(law.get("name", "")))
        status = _esc(str(law.get("status", "")))
        comment = _esc(str(law.get("comment", "")))
        story.append(_p(f"• <b>{name}</b> ({status}): {comment}", body))

    story.append(Spacer(1, 0.25 * cm))
    story.append(_p("<b>Искажения</b>", h2))
    for b in report.get("biases") or []:
        story.append(
            _p(f"• <b>{_esc(str(b.get('name', '')))}</b>: {_esc(str(b.get('hint', '')))}", body)
        )

    story.append(Spacer(1, 0.25 * cm))
    story.append(_p("<b>Альтернативы</b>", h2))
    for i, alt in enumerate(report.get("alternatives") or [], 1):
        story.append(_p(f"{i}. {_esc(str(alt))}", body))

    q = report.get("quote") or {}
    story.append(Spacer(1, 0.5 * cm))
    qt = _esc(str(q.get("text", "")))
    auth = _esc(str(q.get("author", "")))
    story.append(_p(f"«{qt}» — {auth}", body))
    story.append(Spacer(1, 0.8 * cm))
    story.append(
        _p(
            "Логика — ассистент для размышлений, не финансовый и не юридический советник.",
            meta,
        )
    )

    def _draw_bg(canvas: Any, _doc: Any) -> None:
        canvas.saveState()
        canvas.setFillColor(cream)
        canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canvas.setFillColor(accent)
        canvas.rect(0, A4[1] - 8, A4[0], 8, stroke=0, fill=1)
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_bg, onLaterPages=_draw_bg)
    return buf.getvalue()
