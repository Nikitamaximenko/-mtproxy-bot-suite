---
name: frosty-engineering
description: >-
  Работа в репозитории mtproxy-bot-suite (Frosty VPN бот, backend, Vercel, VPS).
  Брать при любой задаче в этом проекте: деплой, VPN, Amnezia, админка, бот, оплата.
---

# Frosty engineering

## Принципы (из CLAUDE.md)

1. **Повторяющееся → скилл** — не объяснять одно и то же в чате; оформлять в `.cursor/skills/`.
2. **Три слоя скилла** — description (когда), instructions (как), `tools/` (скрипты).
3. **Не монолит** — отдельные скиллы: `frosty-engineering`, `frosty-amnezia-pivot`, `frosty-vps`.
4. **Конец сессии** — что забрать в скилл навсегда vs разовая правка.
5. **Повторяемая логика → код** в `scripts/`, не генерировать заново.

## Репозиторий

| Часть | Путь | Деплой |
|-------|------|--------|
| API | `backend/main.py` | Railway + VPS `/opt/frostyvpn` |
| Бот | `bot/main.py` | Railway |
| Админка | `frontend/app/admin/` | Vercel |
| VPS | `138.124.80.97` | SSH, x-ui, `/root/awg` |

После правок в `backend/`, `bot/`, `frontend/`: commit + `git push origin main` (см. `AGENTS.md`).

## Секреты

Не коммитить `.env`, пароли VPS, `ADMIN_API_KEY`, ключи платежей.

## VPN-стеки (2026)

- **Legacy:** VLESS Reality + Happ (`vpn_clients`, x-ui).
- **Pivot:** AmneziaWG UDP (`amnezia_access`, `/root/awg/manage_amneziawg.sh`).
- **Пилот:** только `VPN_STACK_PILOT_TG_IDS` — см. `frosty-amnezia-pivot` и `docs/AMNEZIA_PIVOT.md`.

Реальным пользователям стек не менять без явного запроса.
