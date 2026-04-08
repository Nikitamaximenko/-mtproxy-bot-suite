# Postly

## Что это
Telegram Mini App для быстрого кросспостинга в соцсети РФ
(ВК, ТГ, ОК, Дзен, Rutube) с телефона. Один экран:
выбрал соцсети → текст + медиа → "Опубликовать". Никакого
календаря, аналитики, команд, рубрик, шедулинга.

## ЦА
Самозанятые, локальный бизнес, мелкие блогеры. 1-3 поста
в день с телефона.

## Цена
299₽/мес или 2990₽/год. Lava.top для TMA.

## Стек
- Next.js 14.2 App Router, TypeScript, Tailwind, shadcn/ui
- Sonner для toast
- Веб/PWA: вход по magic link на email (Auth.js / next-auth v5, Nodemailer; в DEV ссылка в консоль сервера)
- Prisma 5.22 + PostgreSQL
- zod
- Bot: aiogram 3 (отдельный сервис, позже, опционально к web-аккаунту)
- Hosting: Railway
- Backend соцсетей: Postmypost API
  (https://help.postmypost.io/docs/api/)

## Принципы
- Mobile-first, кнопки от 44px
- От открытия до публикации — максимум 4 тапа
- Никаких модалок, визардов, тур-тултипов
- Если фича не нужна для MVP — её нет
- Цвета через Telegram themeParams (var(--tg-theme-*)),
  не свои бренд-цвета
