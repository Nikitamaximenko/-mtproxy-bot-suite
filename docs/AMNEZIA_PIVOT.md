# Пивот Frosty на AmneziaWG

Документ стратегии: IP `138.124.80.97` вероятно в реестре РКН или режется DPI на VLESS/TCP 443.
**Реальным пользователям** пока ничего не меняем — только admin-пилот (`VPN_STACK_PILOT_TG_IDS`).

См. также: [AMNEZIA_SETUP.md](./AMNEZIA_SETUP.md), принципы работы в `.cursor/skills/frosty-amnezia-pivot/`.

---

## Почему Hit VPN работает, а Frosty VLESS — нет

| Фактор | Hit VPN | Frosty (сейчас) |
|--------|---------|-----------------|
| IP | Много серверов, ротация | Один IP, мог быть заблокирован целиком |
| Протокол | Часто UDP (WireGuard/Hysteria и др.) | VLESS+Reality на TCP 443 |
| Клиент | Автовыбор живого маршрута | Один профиль Happ |
| Маскировка | Коммерческая инфраструктура | Reality есть, но IP уже «палится» |

**Маскировка Reality** не спасает, если заблокирован **сам IP** или режется **паттерн** к этому IP.

**AmneziaWG** — другой канал (UDP + obfuscation), часто проходит там, где режут классический «VPN на 443».

---

## Что значит «перепродать Amnezia»

Amnezia — **open source** ([amnezia.org](https://amnezia.org/ru)). Вы не покупаете у них «реселлерский» SKU.

Вы продаёте пользователю:

1. **Готовый VPN-доступ** (ключ / QR / подписка).
2. **Поддержку и онбординг** (бот, инструкции).
3. **Биллинг** (ЮKassa / Lava) — то, чего нет у голого self-hosted.

Юридически оформите как «услуга доступа к VPN» в оферте; бренд в приложении — **Frosty**, протокол — AmneziaWG.

---

## Целевая архитектура

```
Пользователь → Telegram-бот Frosty → оплата → whitelist amnezia_access
                    ↓
              AmneziaVPN (импорт vpn:// или QR)
                    ↓
         Новый VPS (EU) : UDP 3568 (или 443/udp) — только AmneziaWG
```

**Не ставить** на новый VPN-сервер: klodbot, nginx stream 443, x-ui для массового VLESS (опционально оставить MTProxy на **другом** IP).

---

## Фазы миграции

### Фаза 0 — сейчас (admin-пилот на старом VPS)

- Env: `VPN_STACK_PILOT_TG_IDS=231115635`, `VPN_STACK_PILOT_PRIMARY=amnezia`.
- В боте у admin: основная кнопка → Amnezia; VLESS помечен как тест.
- Проверить Amnezia на Wi‑Fi и мобильном; зафиксировать скорость/стабильность.
- API: `POST /admin/amnezia-access/{telegram_id}/provision` (создаёт peer через `manage_amneziawg.sh`).

### Фаза 1 — новый VPS (обязательно при блоке IP)

1. VPS EU (Hetzner / Aeza HEL), Ubuntu 24.04.
2. Установка AmneziaVPN → Self-hosted → **Automatic (AmneziaWG)**.
3. Порт UDP **3568** (или другой 1–9999), UFW + `ss -ulnp`.
4. Скопировать практику `/root/awg` или заново `manage_amneziawg.sh`.
5. Обновить `AMNEZIA_SERVER_IP`, перевыдать ключи admin.
6. Старый IP 138.124.80.97 — только API/бот/оплата или полный перенос.

### Фаза 2 — автоматизация (после успешных тестов)

- При активации подписки: `provision-peer.sh tg_{telegram_id}` → запись в `amnezia_access`.
- Лимит устройств = 1 peer на пользователя; отзыв = `remove` в manage script.
- Увеличить `max_slots` с 7 до N по тарифу.

### Фаза 3 — продукт для всех

- Убрать Happ/VLESS из основного UX (или оставить «legacy» для 5%).
- Маркетинг: «Frosty VPN на AmneziaWG — обход блокировок в РФ».
- Mini-app: блок Amnezia как основной.

---

## Операционка (текущий сервер)

```bash
# Создать peer
bash /opt/frostyvpn/.cursor/skills/frosty-amnezia-pivot/tools/provision-peer.sh tg_231115635

# Или напрямую
/root/awg/manage_amneziawg.sh add tg_231115635

# Проверка UDP
ss -ulnp | grep 3568
```

Админка: `/admin/amnezia` → кнопка «Provision peer» (после деплоя).

---

## Риски

- **Тот же IP** — Amnezia тоже могут заблокировать; нужен **свежий** IP.
- **Ручная выдача** — узкое горлышко до фазы 2.
- **Два приложения** — AmneziaVPN vs Happ; в пилоте учим только AmneziaVPN.

---

## Чек-лист admin-теста

- [ ] Удалить старые профили Amnezia/Happ на устройстве
- [ ] Бот → «Подключить VPN» (пилот) → Amnezia QR
- [ ] Интернет: Instagram, YouTube, 2ip.ru
- [ ] Wi‑Fi дома и мобильная сеть
- [ ] Записать: пинг, скорость, обрывы 10 мин
