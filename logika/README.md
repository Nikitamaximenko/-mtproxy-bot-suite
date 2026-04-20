# Логика — прототип веб-приложения

Интерактивный прототип: лендинг, поток (вход, онбординг, диалог, отчёт, кабинет), статическая дизайн-система и превью PDF.

## Запуск

Из корня монорепозитория:

```bash
pnpm install
cd logika && pnpm dev
```

Открой в браузере:

- `/` — лендинг (Lenis, Framer Motion, hero-SVG)
- `/potok` — сценарий приложения без бэкенда (состояние в памяти)
- `/design-system.html` — шаг 1: палитра, типографика, кнопки, поля, карточка, модалка
- `/pdf-preview.html` — шаг 4: вёрстка A4 под будущую генерацию PDF

Сборка:

```bash
cd logika && pnpm build
```

## Деплой на Vercel

1. Создай проект, **Root Directory** = `logika`, пресет **Vite** (или Static: `pnpm install`, `pnpm build`, выходная папка `dist`).
2. Файл `vercel.json` отдаёт `index.html` для клиентских маршрутов (например прямой заход на `/potok`). Статические файлы из `public/` (`design-system.html`, `pdf-preview.html`) обслуживаются как обычно.

## Стек

Vite, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lenis, lucide-react (в React-части), Recharts в кабинете (статистика).

## Документ концепции

См. [CONCEPT.md](./CONCEPT.md) — краткое резюме бренда и дизайн-решений.
