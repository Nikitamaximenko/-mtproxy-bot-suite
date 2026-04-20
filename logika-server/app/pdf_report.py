from __future__ import annotations

import io
import os
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
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


def build_pdf_bytes(report: dict[str, Any], dilemma: str) -> bytes:
    """PDF A4: структура как в экранном отчёте Логика (светлый крем, акцент #c4f542)."""
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
    cream = colors.HexColor("#FAF7F0")
    accent = colors.HexColor("#c4f542")
    accent_muted = colors.HexColor("#6B7F2A")
    ink = colors.HexColor("#0a0a0b")
    body_color = colors.HexColor("#2d2d33")
    muted = colors.HexColor("#5a5a62")
    card_bg = colors.HexColor("#f3f1eb")
    border_c = colors.HexColor("#222226")

    brand_mono = ParagraphStyle(
        name="PdfBrandMono",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=8,
        leading=11,
        textColor=muted,
        spaceAfter=4,
    )
    title = ParagraphStyle(
        name="PdfTitle",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=22,
        leading=28,
        textColor=ink,
        spaceAfter=6,
    )
    h2 = ParagraphStyle(
        name="PdfH2",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=11,
        leading=15,
        textColor=muted,
        spaceAfter=6,
        spaceBefore=10,
    )
    body = ParagraphStyle(
        name="PdfBody",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=10,
        leading=14,
        textColor=body_color,
    )
    verdict_style = ParagraphStyle(
        name="PdfVerdict",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=13,
        leading=18,
        textColor=ink,
        spaceBefore=8,
        spaceAfter=6,
    )
    meta = ParagraphStyle(
        name="PdfMeta",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=8,
        leading=11,
        textColor=muted,
    )
    quote_style = ParagraphStyle(
        name="PdfQuote",
        parent=styles["Normal"],
        fontName=fn,
        fontSize=12,
        leading=17,
        textColor=ink,
        leftIndent=0,
        spaceBefore=6,
        spaceAfter=4,
    )

    w = doc.width
    story: list[Any] = []

    score = int(report.get("overall_score") or 0)
    sc_hex = _score_hex(score)

    # Шапка: бренд + дата (как в UI)
    gen_iso = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    header_tbl = Table(
        [
            [
                _p(
                    f'<font name="{fn}" color="#0a0a0b"><b>ЛОГИКА.</b></font> '
                    f'<font name="{fn}" color="#c4f542"><b>·</b></font> '
                    f'<font name="{fn}" color="#5a5a62">Аналитический отчёт</font>',
                    body,
                ),
                _p(f'<font name="{fn}" color="#5a5a62">Документ<br/></font>'
                    f'<font name="{fn}" color="#0a0a0b">{_esc(gen_iso)}</font>', meta),
            ]
        ],
        colWidths=[w * 0.68, w * 0.32],
    )
    header_tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_tbl)
    story.append(_p('<font name="%s" color="#0a0a0b"><b>Разбор решения</b></font>' % fn, title))
    story.append(Spacer(1, 0.25 * cm))

    if (dilemma or "").strip():
        story.append(_p(f'<font name="{fn}" color="#5a5a62">Исходный запрос</font>', brand_mono))
        story.append(_p(f'«{_esc(dilemma.strip())}»', body))
        story.append(Spacer(1, 0.4 * cm))

    # Карточка оценки (таблица с фоном)
    score_para = _p(
        f'<font name="{fn}" color="#5a5a62">OVERALL SCORE</font><br/><br/>'
        f'<font name="{fn}" color="{sc_hex}"><b><font size="42">{score}</font></b></font>'
        f'<font name="{fn}" color="#9a9aa4">  / 100</font>',
        body,
    )
    verdict_txt = _esc(str(report.get("verdict_short") or "Решение частично логично"))
    verdict_block = _p(f"<b>{verdict_txt}</b>", verdict_style)
    summary = str(report.get("summary") or "").strip()
    summary_block = (
        _p(_esc(summary), body) if summary else _p(_esc("Твои аргументы проверены по законам логики."), body)
    )

    score_card = Table(
        [[score_para], [verdict_block], [summary_block]],
        colWidths=[w],
    )
    score_card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border_c),
                ("LINEABOVE", (0, 0), (0, 0), 3, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    story.append(score_card)
    story.append(Spacer(1, 0.45 * cm))

    law_dicts = [x for x in (report.get("laws") or []) if isinstance(x, dict)]
    if law_dicts:
        story.append(_p('<font name="%s" color="#5a5a62"><b>Законы логики</b></font>' % fn, h2))
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
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
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
        canvas.setFillColor(cream)
        canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canvas.setFillColor(accent)
        canvas.rect(0, A4[1] - 6, A4[0], 6, stroke=0, fill=1)
        canvas.setStrokeColor(accent_muted)
        canvas.setLineWidth(0.3)
        canvas.line(1.8 * cm, A4[1] - 1.6 * cm, A4[0] - 1.8 * cm, A4[1] - 1.6 * cm)
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_bg, onLaterPages=_draw_bg)
    return buf.getvalue()
