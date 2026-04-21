"""
HTML отчёта 1:1 с logika/src/components/report/ReportView.tsx (структура и токены из index.css).
Используется для PDF через Chromium (Playwright), а не дублирование в ReportLab.
"""

from __future__ import annotations

from datetime import datetime
from html import escape
from typing import Any

# Цвета оценки — как reportScoreColor в ReportView
def _score_color(score: int) -> str:
    if score < 40:
        return "#ff4d4d"
    if score < 70:
        return "#ffb23d"
    return "#c4f542"


_RU_MONTHS = (
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)


def _format_ru_date(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    try:
        if dt.tzinfo:
            dt = dt.astimezone(__import__("datetime").timezone.utc)
        return f"{dt.day} {_RU_MONTHS[dt.month - 1]} {dt.year}"
    except Exception:
        return None


def _split_summary_blocks(text: str) -> list[str]:
    t = text.strip()
    if not t:
        return []
    return [p.strip() for p in t.split("\n\n") if p.strip()]


def _esc(s: object) -> str:
    return escape(str(s), quote=False)


def build_report_html(
    report: dict[str, Any],
    dilemma: str,
    *,
    document_date: datetime | None = None,
) -> str:
    """Полный HTML-документ (печать / PDF), визуально как экран отчёта."""
    score = int(report.get("overall_score") or 0)
    score_display = score
    color = _score_color(score)
    date_label = _format_ru_date(document_date)

    laws = report.get("laws") if isinstance(report.get("laws"), list) else []
    laws_list = [x for x in laws if isinstance(x, dict)]
    if not laws_list:
        laws_list = [
            {"name": "Тождество", "status": "частично", "comment": "…"},
            {"name": "Непротиворечие", "status": "да", "comment": "…"},
            {"name": "Исключённое третье", "status": "нет", "comment": "…"},
            {"name": "Достаточное основание", "status": "частично", "comment": "…"},
        ]

    biases = report.get("biases") if isinstance(report.get("biases"), list) else []
    bias_list = [x for x in biases if isinstance(x, dict)]
    if not bias_list:
        bias_list = [{"name": "—", "hint": "Нет данных"}]

    alts = report.get("alternatives") if isinstance(report.get("alternatives"), list) else []
    alternatives = [str(x) for x in alts if x]
    if not alternatives:
        alternatives = [
            "Остаться на 90 дней с измеримым экспериментом.",
            "Уточнить финансовый буфер цифрами.",
            "Сменить контекст без смены работы.",
        ]

    quote = report.get("quote")
    if not isinstance(quote, dict):
        quote = None

    summary_fallback = "Твои аргументы проверены по четырём законам логики и типичным искажениям."
    summary_raw = str(report.get("summary") or "").strip()
    summary_source = summary_raw if summary_raw else summary_fallback
    summary_parts = _split_summary_blocks(summary_source)

    dilemma_text = (dilemma or "").strip()
    if len(dilemma_text) > 320:
        dilemma_text = dilemma_text[:320] + "…"

    verdict = str(report.get("verdict_short") or "Решение частично логично")
    conclusion_raw = str(report.get("conclusion") or "").strip()
    vs = str(report.get("verdict_short") or "").strip()
    if conclusion_raw:
        conclusion_text = conclusion_raw
    elif vs:
        conclusion_text = vs
    else:
        conclusion_text = (
            "Сведи вывод к одному ясному следующему шагу: что проверить, что принять или что отложить — "
            "исходя из твоих же формулировок выше."
        )

    quote_text = str(quote.get("text") or "") if quote else ""
    quote_author = str(quote.get("author") or "") if quote else ""
    if not quote_text:
        quote_text = "Когда факты меняются, я меняю мнение."
    if not quote_author:
        quote_author = "Кейнс"

    # Сетка законов
    law_cells = []
    for row in laws_list:
        law_cells.append(
            f"""<div class="law-card">
  <div class="law-head">
    <h3 class="law-name">{_esc(row.get("name", ""))}</h3>
    <span class="law-status">{_esc(row.get("status", ""))}</span>
  </div>
  <p class="law-comment">{_esc(row.get("comment", ""))}</p>
</div>"""
        )
    laws_html = '<div class="laws-grid">' + "".join(law_cells) + "</div>"

    bias_items = []
    for b in bias_list:
        nm = _esc(b.get("name", ""))
        hint = b.get("hint") or ""
        hint_part = f" — {_esc(hint)}" if hint else ""
        bias_items.append(
            f'<li class="bias-li"><span class="bias-name">{nm}</span>{hint_part}</li>'
        )
    biases_html = '<ul class="bias-ul">' + "".join(bias_items) + "</ul>"

    alt_items = "".join(f'<li class="alt-li">{_esc(line)}</li>' for line in alternatives)
    summary_body = "".join(f'<p class="sum-p">{_esc(block)}</p>' for block in summary_parts)

    dilemma_block = ""
    if dilemma_text:
        dilemma_block = f"""<section class="card card-dilemma">
  <h2 class="label">Исходный запрос</h2>
  <p class="dilemma-quote">«{_esc(dilemma_text)}»</p>
</section>"""

    date_html = date_label if date_label else "Только что"

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Логика — отчёт</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    * {{ box-sizing: border-box; }}
    @page {{
      size: A4 portrait;
      /* Единственные поля страницы: в pdf_playwright margin отключён, чтобы не дублировать отступы */
      margin: 14mm 14mm 16mm 14mm;
    }}
    html {{
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    body {{
      margin: 0;
      padding: 0;
      background: #0a0a0b;
      color: #f5f5f7;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }}
    .report {{
      max-width: 48rem;
      margin: 0 auto;
      padding: 0 0 48px;
    }}
    .header-row {{
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 32px;
      border-bottom: 1px solid rgba(34, 34, 38, 0.8);
    }}
    .brand-block {{ display: flex; flex-direction: column; gap: 12px; }}
    .logo-row {{ display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }}
    .logo {{
      font-weight: 500;
      letter-spacing: -0.04em;
      font-size: clamp(1.25rem, 4vw, 1.5rem);
      color: #f5f5f7;
    }}
    .logo-dot {{ color: #c4f542; }}
    .badge {{
      display: inline-block;
      background: rgba(196, 245, 66, 0.12);
      color: #c4f542;
      border: 1px solid rgba(196, 245, 66, 0.25);
      border-radius: 9999px;
      padding: 4px 12px;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }}
    .h1 {{
      max-width: 36rem;
      font-size: clamp(1.65rem, 5vw, 1.875rem);
      font-weight: 500;
      line-height: 1.2;
      letter-spacing: -0.03em;
      margin: 0;
    }}
    .date-box {{
      flex-shrink: 0;
      border: 1px solid #222226;
      border-radius: 16px;
      background: rgba(26, 26, 29, 0.6);
      padding: 16px 20px;
      min-width: 160px;
      text-align: right;
    }}
    .date-box .dl {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #5a5a62;
      margin: 0;
    }}
    .date-box .dv {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 14px;
      color: #f5f5f7;
      margin: 8px 0 0;
      line-height: 1.375;
    }}
    .card {{
      border: 1px solid #222226;
      border-radius: 16px;
      margin-top: 32px;
    }}
    .card-dilemma {{
      background: rgba(18, 18, 20, 0.5);
      padding: 28px 32px 36px;
    }}
    .label {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #5a5a62;
      margin: 0;
    }}
    .dilemma-quote {{
      margin: 20px 0 0;
      font-size: 15px;
      line-height: 1.75;
      color: #f5f5f7;
    }}
    .score-section {{
      background: linear-gradient(180deg, rgba(18, 18, 20, 0.8) 0%, rgba(26, 26, 29, 0.3) 100%);
      border: 1px solid #222226;
      border-radius: 16px;
      padding: 32px 40px 44px;
      margin-top: 32px;
    }}
    .score-top {{
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      padding-bottom: 32px;
      margin-bottom: 0;
      border-bottom: 1px solid rgba(196, 245, 66, 0.35);
    }}
    .overall {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #5a5a62;
      text-align: right;
      line-height: 1.4;
    }}
    .score-label {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #5a5a62;
      margin: 0;
    }}
    .score-num-row {{
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 12px;
      margin-top: 16px;
    }}
    .big-score {{
      font-size: clamp(3.25rem, 10vw, 5.75rem);
      font-weight: 500;
      line-height: 1;
      letter-spacing: -0.04em;
      color: {color};
    }}
    .over-100 {{
      font-size: clamp(1.5rem, 4vw, 1.875rem);
      font-weight: 500;
      color: #9a9aa4;
      padding-bottom: 4px;
    }}
    .stack {{
      margin-top: 40px;
    }}
    .stack > div + div {{ margin-top: 40px; }}
    .verdict-label, .parse-label {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #5a5a62;
      margin: 0;
    }}
    .verdict-text {{
      margin: 16px 0 0;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 500;
      line-height: 1.375;
      letter-spacing: -0.02em;
      color: #f5f5f7;
    }}
    .parse-block {{
      border-top: 1px solid #222226;
      padding-top: 32px;
      margin-top: 40px;
    }}
    .sum-p {{
      margin: 20px 0 0;
      max-width: 65ch;
      font-size: 15px;
      line-height: 1.78;
      color: #9a9aa4;
    }}
    .sum-p:first-of-type {{ margin-top: 20px; }}
    .laws-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px 24px;
      margin-top: 48px;
    }}
    @media print {{
      .law-card {{
        break-inside: avoid;
        page-break-inside: avoid;
      }}
      .score-section {{
        break-inside: avoid;
        page-break-inside: avoid;
      }}
      blockquote {{
        break-inside: avoid;
        page-break-inside: avoid;
      }}
      .conclusion {{
        break-inside: avoid;
        page-break-inside: avoid;
      }}
    }}
    .law-card {{
      border: 1px solid #222226;
      background: #121214;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      text-align: left;
      min-height: 100%;
    }}
    .law-head {{
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
    }}
    .law-name {{
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      line-height: 1.375;
      color: #f5f5f7;
    }}
    .law-status {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5a5a62;
      flex-shrink: 0;
    }}
    .law-comment {{
      margin: 16px 0 0;
      font-size: 14px;
      line-height: 1.625;
      color: #9a9aa4;
    }}
    .section-h {{
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #5a5a62;
      margin: 56px 0 0;
    }}
    .bias-ul {{
      list-style: none;
      padding: 0;
      margin: 20px 0 0;
    }}
    .bias-li {{
      border: 1px solid #222226;
      background: #1a1a1d;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 14px;
      color: #9a9aa4;
      margin-top: 12px;
    }}
    .bias-li:first-child {{ margin-top: 0; }}
    .bias-name {{ color: #f5f5f7; }}
    .alt-ol {{
      margin: 20px 0 0;
      padding-left: 24px;
      color: #9a9aa4;
      font-size: 15px;
      line-height: 1.625;
    }}
    .alt-li {{ margin-top: 16px; }}
    .alt-li:first-child {{ margin-top: 0; }}
    blockquote {{
      margin: 64px 0 0;
      border: 1px solid #222226;
      background: #121214;
      border-radius: 16px;
      padding: 28px 36px;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 500;
      line-height: 1.375;
      letter-spacing: -0.02em;
      text-align: left;
    }}
    blockquote footer {{
      display: block;
      margin-top: 32px;
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #5a5a62;
      font-weight: 400;
    }}
    .conclusion {{
      margin-top: 56px;
      border: 1px solid rgba(196, 245, 66, 0.4);
      border-left: 4px solid rgba(196, 245, 66, 0.55);
      background: rgba(26, 26, 29, 0.8);
      border-radius: 16px;
      padding: 32px 40px 36px;
    }}
    .conclusion .label {{ margin: 0; }}
    .conclusion-text {{
      margin: 24px 0 0;
      max-width: 65ch;
      font-size: 17px;
      font-weight: 500;
      line-height: 1.65;
      letter-spacing: -0.01em;
      color: #f5f5f7;
      white-space: pre-wrap;
    }}
    .pdf-footer {{
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid rgba(34, 34, 38, 0.8);
      font-family: "JetBrains Mono", ui-monospace, monospace;
      font-size: 10px;
      line-height: 1.5;
      letter-spacing: 0.02em;
      color: #5a5a62;
      max-width: 48rem;
    }}
  </style>
</head>
<body>
  <div class="report">
    <header class="header-row">
      <div class="brand-block">
        <div class="logo-row">
          <span class="logo">ЛОГИКА<span class="logo-dot">.</span></span>
          <span class="badge">Отчёт</span>
        </div>
        <h1 class="h1">Разбор решения</h1>
      </div>
      <div class="date-box">
        <p class="dl">Дата документа</p>
        <p class="dv">{_esc(date_html)}</p>
      </div>
    </header>

    {dilemma_block}

    <section class="score-section" aria-labelledby="score-h">
      <div class="score-top">
        <div>
          <p class="score-label" id="score-h">Оценка</p>
          <div class="score-num-row">
            <span class="big-score">{score_display}</span>
            <span class="over-100">/ 100</span>
          </div>
        </div>
        <div class="overall">Overall<br />score</div>
      </div>

      <div class="stack">
        <div>
          <p class="verdict-label">Вердикт</p>
          <p class="verdict-text">{_esc(verdict)}</p>
        </div>
        <div class="parse-block">
          <p class="parse-label">Разбор</p>
          <div class="parse-body">{summary_body}</div>
        </div>
      </div>
    </section>

    {laws_html}

    <h3 class="section-h">Искажения</h3>
    {biases_html}

    <h3 class="section-h">Альтернативы</h3>
    <ol class="alt-ol">{alt_items}</ol>

    <blockquote>
      {_esc(quote_text)}
      <footer>{_esc(quote_author)}</footer>
    </blockquote>

    <div class="conclusion">
      <p class="label">Финальный вывод</p>
      <p class="conclusion-text">{_esc(conclusion_text)}</p>
    </div>

    <p class="pdf-footer">Логика — ассистент для размышлений, не финансовый и не юридический советник.</p>
  </div>
</body>
</html>"""

