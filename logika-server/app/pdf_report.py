from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def build_pdf_bytes(report: dict[str, Any], dilemma: str) -> bytes:
    """Кремовый фон по брифу PDF, лаконичная вёрстка."""
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
    title = ParagraphStyle(
        name="Title",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=colors.HexColor("#1a1a1d"),
        spaceAfter=12,
    )
    body = ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#3a3a40"),
    )
    meta = ParagraphStyle(
        name="Meta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#6b6b72"),
    )

    story: list[Any] = []
    story.append(Paragraph("ЛОГИКА.", title))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Анализ решения", styles["Heading2"]))
    story.append(Spacer(1, 0.3 * cm))
    score = report.get("overall_score", 0)
    story.append(Paragraph(f"<b>Оценка:</b> {score} / 100", body))
    story.append(Paragraph(f"<i>{report.get('verdict_short', '')}</i>", body))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("<b>Дилемма</b>", body))
    story.append(Paragraph(dilemma.replace("&", "&amp;").replace("<", "&lt;"), body))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("<b>Итог</b>", body))
    summary = (report.get("summary") or "").replace("&", "&amp;").replace("<", "&lt;")
    for para in summary.split("\n\n"):
        if para.strip():
            story.append(Paragraph(para.strip(), body))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("<b>Законы логики</b>", body))
    for law in report.get("laws") or []:
        story.append(
            Paragraph(
                f"• {law.get('name', '')} — {law.get('status', '')}: {law.get('comment', '')}",
                body,
            )
        )
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("<b>Искажения</b>", body))
    for b in report.get("biases") or []:
        story.append(Paragraph(f"• {b.get('name', '')}: {b.get('hint', '')}", body))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("<b>Альтернативы</b>", body))
    for i, alt in enumerate(report.get("alternatives") or [], 1):
        story.append(Paragraph(f"{i}. {alt}", body))
    q = report.get("quote") or {}
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(f"«{q.get('text', '')}» — {q.get('author', '')}", body))
    story.append(Spacer(1, 1 * cm))
    story.append(
        Paragraph(
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
