---
name: frosty-amnezia-pivot
description: >-
  Пивот Frosty на AmneziaWG, обход блокировки VPS/IP РКН, выдача ключей, whitelist,
  admin-пилот, новый сервер, manage_amneziawg.sh. Не использовать для MTProxy-only задач.
---

# Frosty → Amnezia pivot

## Когда брать скилл

- Заблокирован IP / VLESS не работает у пользователей в РФ.
- «Перепродать Amnezia», «база на AmneziaWG», миграция с Happ.
- Admin-only тесты нового стека.

## Радикальный план (кратко)

1. **Новый VPS** (не 138.124.80.97) — Финляндия/Нидерланды, **только** AmneziaWG, без x-ui на 443.
2. **UDP-порт** 1–9999 (сейчас 3568), открыть в UFW.
3. **Выдача ключей:** `tools/provision-peer.sh` → `manage_amneziawg.sh add tg_<id>`.
4. **Продукт:** подписка Frosty → whitelist `amnezia_access` → QR/`vpn://` в боте.
5. **Юридически:** Amnezia — open source; вы продаёте **доступ + поддержку + биллинг**, не лицензию «Amnezia».

## Почему Hit VPN работает

Много IP, автопереключение, UDP-протоколы, IP не в реестре. Один заблокированный IP Frosty ≠ провал технологии, нужен **новый IP + UDP**.

## Admin-пилот (не трогать всех юзеров)

Env:

```env
VPN_STACK_PILOT_TG_IDS=231115635
VPN_STACK_PILOT_PRIMARY=amnezia
```

Поведение: у pilot-ID главная кнопка «Подключить VPN» ведёт в Amnezia; VLESS — «устаревший (тест)».

API: `GET /vpn/stack/{telegram_id}`, `POST /admin/amnezia-access/{id}/provision` (только VPS с `/root/awg`).

## Инструменты

- `tools/provision-peer.sh` — создать peer на сервере.
- `docs/AMNEZIA_PIVOT.md` — полная стратегия и фазы.

## Фазы

| Фаза | Действие |
|------|----------|
| 0 | Admin-пилот на текущем VPS (тест Amnezia) |
| 1 | Новый VPS, перенос awg, смена `AMNEZIA_SERVER_IP` |
| 2 | Автовыдача peer при оплате (только после стабильных тестов) |
| 3 | Скрыть VLESS для всех / rebranding «Frosty = Amnezia» |
