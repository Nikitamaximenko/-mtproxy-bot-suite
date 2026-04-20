"""Курируемые цитаты с id — модель не должна придумывать авторов."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CuratedQuote:
    id: str
    text: str
    author: str
    tags: frozenset[str]


# Короткий стартовый корпус; в проде — загрузка из БД + эмбеддинги.
QUOTES: tuple[CuratedQuote, ...] = (
    CuratedQuote(
        "q_descartes_1",
        "Мыслю, следовательно существую.",
        "Декарт",
        frozenset({"эго", "сомнение", "опора"}),
    ),
    CuratedQuote(
        "q_aristotle_1",
        "Мы — то, что мы делаем снова и снова. Совершенство, стало быть, не действие, а привычка.",
        "Аристотель",
        frozenset({"привычка", "действие"}),
    ),
    CuratedQuote(
        "q_kahneman_1",
        "Система 1 думает быстро, Система 2 — медленно; большинство решений — на автопилоте.",
        "Канеман (парафраз)",
        frozenset({"решение", "автопилот", "риск"}),
    ),
    CuratedQuote(
        "q_frankl_1",
        "Между стимулом и реакцией есть пространство. В этом пространстве — наша свобода.",
        "Виктор Франкл",
        frozenset({"свобода", "реакция", "ответственность"}),
    ),
    CuratedQuote(
        "q_keynes_1",
        "Когда факты меняются, я меняю мнение. А вы?",
        "Кейнс",
        frozenset({"факты", "гибкость", "мнение"}),
    ),
    CuratedQuote(
        "q_taleb_1",
        "Нас не убивают незнания, а иллюзия знания.",
        "Нассим Талеб (парафраз)",
        frozenset({"риск", "уверенность"}),
    ),
    CuratedQuote(
        "q_russell_1",
        "Сомневаться в том, что принято без сомнения, — первый шаг к истине.",
        "Бертран Рассел (парафраз)",
        frozenset({"сомнение", "истина"}),
    ),
    CuratedQuote(
        "q_socrates_1",
        "Я знаю, что ничего не знаю.",
        "Сократ (парафраз)",
        frozenset({"неопределённость", "честность"}),
    ),
)


def retrieve_quotes_for_context(dilemma: str, verdict_keywords: str = "", k: int = 6) -> str:
    """Простой отбор: пересечение слов с текстом цитаты/тегов; fallback — первые k."""
    low = (dilemma + " " + verdict_keywords).lower()
    words = {w.strip(".,!?«»()") for w in low.split() if len(w) > 2}
    scored: list[tuple[int, CuratedQuote]] = []
    for q in QUOTES:
        blob = (q.text + " " + q.author + " " + " ".join(q.tags)).lower()
        score = sum(1 for w in words if w in blob)
        scored.append((score, q))
    scored.sort(key=lambda x: -x[0])
    picked = [x[1] for x in scored if x[0] > 0][:k]
    if len(picked) < k:
        for q in QUOTES:
            if q not in picked:
                picked.append(q)
            if len(picked) >= k:
                break
    lines = []
    for q in picked[:k]:
        lines.append(f"[{q.id}] «{q.text}» — {q.author}")
    return "\n".join(lines)
