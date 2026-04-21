from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

from app.config import get_settings

logger = logging.getLogger(__name__)

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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


def _score_hex(score: int) -> str:
    if score < 40:
        return "#ff4d4d"
    if score < 70:
        return "#ffb23d"
    return "#c4f542"


def _truncate_intro(text: str, max_chars: int = 160) -> str:
    """Сокращает вводный текст в PDF (~половина длинного запроса)."""
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 1].rstrip() + "…"


def build_pdf_bytes_reportlab(report: dict[str, Any], dilemma: str) -> bytes:
    """Запасной PDF через ReportLab (без Chromium). Визуально хуже совпадает с сайтом."""
    fn = _register_cyrillic_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.8 * cm,
    )
    styles = getSampleStyleSheet()
    # Дизайн-токены сайта
    page_bg = colors.HexColor("#0a0a0b")
    accent = colors.HexColor("#c4f542")
    fg = colors.HexColor("#f5f5f7")
    body_muted = colors.HexColor("#9a9aa4")
    dim = colors.HexColor("#5a5a62")
    label_gray = colors.HexColor("#8a8a94")
    card_bg = colors.HexColor("#121214")
    elevated = colors.HexColor("#1a1a1d")
    border_c = colors.HexColor("#222226")
    divider = colors.HexColor("#2e2e34")

    title_doc = ParagraphStyle(
        name="PdfTitleDoc",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=18,
        leading=24,
        textColor=fg,
        spaceAfter=4,
        spaceBefore=0,
    )
    intro_brand = ParagraphStyle(
        name="PdfIntroBrand",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=12,
        leading=16,
        textColor=fg,
        spaceAfter=2,
    )
    intro_date = ParagraphStyle(
        name="PdfIntroDate",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=9,
        leading=12,
        textColor=dim,
        alignment=TA_RIGHT,
    )
    section_label = ParagraphStyle(
        name="PdfSectionLabel",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=8,
        leading=11,
        textColor=label_gray,
        spaceAfter=6,
        spaceBefore=0,
    )
    intro_dilemma = ParagraphStyle(
        name="PdfIntroDilemma",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=10,
        leading=15,
        textColor=fg,
        spaceBefore=4,
    )
    body_loose = ParagraphStyle(
        name="PdfBodyLoose",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=10,
        leading=16,
        textColor=body_muted,
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        name="PdfH2",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=11,
        leading=15,
        textColor=dim,
        spaceAfter=6,
        spaceBefore=10,
    )
    body = ParagraphStyle(
        name="PdfBody",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=10,
        leading=14,
        textColor=body_muted,
    )
    verdict_style = ParagraphStyle(
        name="PdfVerdict",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=14,
        leading=20,
        textColor=fg,
        spaceBefore=4,
        spaceAfter=14,
    )
    meta = ParagraphStyle(
        name="PdfMeta",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=8,
        leading=11,
        textColor=dim,
    )
    quote_style = ParagraphStyle(
        name="PdfQuote",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=12,
        leading=17,
        textColor=fg,
        leftIndent=0,
        spaceBefore=6,
        spaceAfter=4,
    )

    w = doc.width
    story: list[Any] = []

    score = int(report.get("overall_score") or 0)
    sc_hex = _score_hex(score)

    gen_iso = datetime.now(timezone.utc).strftime("%d.%m.%Y")

    # Шапка: бренд + дата (воздух), затем заголовок; запрос и оценка — отдельные блоки
    intro_left = _p(
        f'<font color="#f5f5f7"><b>ЛОГИКА.</b></font> <font color="#c4f542">·</font><br/>'
        f'<font color="#5a5a62" size="8">Аналитический отчёт</font>',
        intro_brand,
    )
    intro_right = _p(
        f'<font color="#8a8a94" size="7">ДАТА ДОКУМЕНТА</font><br/>'
        f'<font color="#f5f5f7" size="10">{_esc(gen_iso)}</font>',
        intro_date,
    )
    intro_tbl = Table([[intro_left, intro_right]], colWidths=[w * 0.62, w * 0.38])
    intro_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, border_c),
            ]
        )
    )
    story.append(intro_tbl)
    story.append(Spacer(1, 0.45 * cm))
    story.append(_p('<font color="#f5f5f7"><b>Разбор решения</b></font>', title_doc))
    story.append(Spacer(1, 0.5 * cm))

    dilemma_raw = (dilemma or "").strip()
    if dilemma_raw:
        dilemma_short = _truncate_intro(dilemma_raw, max_chars=200)
        dilemma_box = Table(
            [
                [
                    _p(
                        f'<font color="#8a8a94" size="7">ИСХОДНЫЙ ЗАПРОС</font><br/><br/>'
                        f'<font color="#f5f5f7">«{_esc(dilemma_short)}»</font>',
                        intro_dilemma,
                    )
                ]
            ],
            colWidths=[w],
        )
        dilemma_box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                    ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                    ("LEFTPADDING", (0, 0), (-1, -1), 16),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                    ("TOPPADDING", (0, 0), (-1, -1), 14),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
                ]
            )
        )
        story.append(dilemma_box)
        story.append(Spacer(1, 0.55 * cm))

    score_para = _p(
        f'<font name="{fn}" color="#8a8a94" size="8">ОЦЕНКА</font><br/><br/>'
        f'<font name="{fn}" color="{sc_hex}"><b><font size="38">{score}</font></b></font>'
        f'<font name="{fn}" color="#9a9aa4">  / 100</font>',
        body,
    )
    verdict_txt = _esc(str(report.get("verdict_short") or "Решение частично логично"))
    verdict_block = _p(f"<b>{verdict_txt}</b>", verdict_style)
    summary_raw = str(report.get("summary") or "").strip()
    summary_short = _truncate_intro(summary_raw, 320) if summary_raw else ""
    summary_parts: list[str] = []
    if summary_short:
        summary_parts = [p.strip() for p in summary_short.replace("\r\n", "\n").split("\n\n") if p.strip()]
    if not summary_parts:
        summary_parts = ["Проверка по законам логики и типичным искажениям."]

    score_inner: list[Any] = [
        [score_para],
        [_p('<font color="#8a8a94" size="8">ВЕРДИКТ</font>', section_label)],
        [verdict_block],
        [_p('<font color="#8a8a94" size="8">РАЗБОР</font>', section_label)],
    ]
    for para in summary_parts:
        score_inner.append([_p(_esc(para), body_loose)])

    score_card = Table(score_inner, colWidths=[w])
    div_line = divider
    score_card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                ("LINEABOVE", (0, 0), (0, 0), 3, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("TOPPADDING", (0, 0), (0, 0), 20),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 20),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, div_line),
                ("LINEBELOW", (0, 2), (-1, 2), 0.5, div_line),
            ]
        )
    )
    story.append(score_card)
    story.append(Spacer(1, 0.55 * cm))

    law_dicts = [x for x in (report.get("laws") or []) if isinstance(x, dict)]
    if law_dicts:
        col_w = (w - 8) / 2

        def _law_cell(ld: dict[str, Any]) -> Paragraph:
            nm = _esc(str(ld.get("name", "")))
            st = _esc(str(ld.get("status", "")))
            cm_ = _esc(str(ld.get("comment", "")))
            return _p(f"<b>{nm}</b> <font color='#5a5a62'>({st})</font><br/>{cm_}", body)

        for i in range(0, len(law_dicts), 2):
            left = _law_cell(law_dicts[i])
            right = _law_cell(law_dicts[i + 1]) if i + 1 < len(law_dicts) else _p("", body)
            row_cells = [left, right]
            t = Table([row_cells], colWidths=[col_w, col_w])
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                        ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 10),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                        ("TOPPADDING", (0, 0), (-1, -1), 10),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 0.2 * cm))

    story.append(_p('<font name="%s" color="#5a5a62"><b>Искажения</b></font>' % fn, h2))
    for b in report.get("biases") or []:
        if isinstance(b, dict):
            story.append(
                _p(
                    f"• <b>{_esc(str(b.get('name', '')))}</b>: {_esc(str(b.get('hint', '')))}",
                    body,
                )
            )

    story.append(Spacer(1, 0.2 * cm))
    story.append(_p('<font name="%s" color="#5a5a62"><b>Альтернативы</b></font>' % fn, h2))
    for idx, alt in enumerate(report.get("alternatives") or [], 1):
        story.append(_p(f"{idx}. {_esc(str(alt))}", body))

    q = report.get("quote") or {}
    qt = _esc(str(q.get("text", "")))
    auth = _esc(str(q.get("author", "")))
    story.append(Spacer(1, 0.35 * cm))
    quote_tbl = Table(
        [[_p(f"«{qt}»<br/><br/><font color='#5a5a62'>{auth}</font>", quote_style)]],
        colWidths=[w],
    )
    quote_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(quote_tbl)

    conclusion = str(report.get("conclusion") or "").strip()
    if conclusion:
        story.append(Spacer(1, 0.35 * cm))
        conc_tbl = Table(
            [
                [
                    _p(
                        f'<font name="{fn}" color="#5a5a62"><b>Финальный вывод</b></font><br/><br/>'
                        + "<br/>".join(_esc(p.strip()) for p in conclusion.split("\n\n") if p.strip()),
                        body,
                    )
                ]
            ],
            colWidths=[w],
        )
        conc_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                    ("LINEBEFORE", (0, 0), (0, 0), 3, accent),
                    ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                    ("LEFTPADDING", (0, 0), (-1, -1), 14),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ]
            )
        )
        story.append(conc_tbl)

    story.append(Spacer(1, 0.7 * cm))
    story.append(
        _p(
            "Логика — ассистент для размышлений, не финансовый и не юридический советник.",
            meta,
        )
    )

    def _draw_bg(canvas: Any, _doc: Any) -> None:
        canvas.saveState()
        canvas.setFillColor(page_bg)
        canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_bg, onLaterPages=_draw_bg)
    return buf.getvalue()


def build_pdf_bytes(
    report: dict[str, Any],
    dilemma: str,
    *,
    document_date: datetime | None = None,
) -> bytes:
    """
    PDF как на сайте: Chromium + HTML (как ReportView). Иначе при ошибке — ReportLab,
    если `pdf_fallback_reportlab` (см. .env / Settings).
    """
    s = get_settings()
    if s.pdf_engine == "playwright":
        try:
            from app.report_html import build_report_html
            from app.pdf_playwright import html_to_pdf_bytes

            html = build_report_html(report, dilemma, document_date=document_date)
            return html_to_pdf_bytes(html)
        except Exception as e:
            logger.warning("PDF playwright: %s", e, exc_info=True)
            if s.pdf_fallback_reportlab:
                return build_pdf_bytes_reportlab(report, dilemma)
            raise
    return build_pdf_bytes_reportlab(report, dilemma)
