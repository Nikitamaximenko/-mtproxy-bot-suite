# Amnezia VPN в Frosty (отдельная ветка, до 7 человек)

Amnezia **не заменяет** Frosty VLESS (Happ). Это второй VPN на том же VPS, видимый только пользователям из whitelist в админке.

## 1. Установка на сервере (один раз)

Официальный способ — приложение **AmneziaVPN** на Mac/Windows/Linux:

1. Скачать: https://amnezia.org/ru  
2. «+» → **Self-hosted VPN**  
3. IP: `138.124.80.97`, SSH `root`, пароль VPS  
4. Режим **Automatic** (AmneziaWG) или Manual → AmneziaWG  
5. После установки в настройках протокола сменить **UDP-порт на 1–9999** (не высокий случайный) — иначе часть операторов режет. Проверить, что порт не занят: `ss -ulnp | grep <port>`

**Важно:** Frosty Xray на `10443`/stream `443` и klodbot на `443` не трогаем. AmneziaWG — отдельный **UDP**-порт (сейчас **3568**, preset mobile).

**Подключение:** основной способ — **AmneziaVPN** + QR/`vpn://` из бота. Запасной — **AmneziaWG** (файл или QR). После смены параметров на сервере все должны **удалить старый профиль** и импортировать ключ заново.

Проверка сервисов на VPS:

```bash
ss -tlnp | grep -E ':443|:10443'
ss -ulnp   # порт AmneziaWG после установки
```

## 2. Гостевые ключи (7 человек)

В AmneziaVPN (полный доступ к серверу):

1. Иконка **Share** → **Share VPN Access** (гостевой доступ, не full access)  
2. Имя пользователя, протокол **AmneziaWG**, формат **для AmneziaVPN** → `vpn://...`  
3. **Copy** или файл `amnezia_config.vpn`

Каждый гость = **1 устройство**, ключ можно отозвать в Users.

Документация: https://docs.amnezia.org/documentation/instructions/share-connection/

## 3. Whitelist в Frosty

Админка: **/admin/amnezia** или API:

```bash
curl -X POST "https://<backend>/admin/amnezia-access" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 123456789, "vpn_key": "vpn://...", "key_format": "vpn", "label": "Имя"}'
```

Сначала можно добавить только `telegram_id` (без ключа) — в боте появится кнопка «🌿 Amnezia VPN», текст «ключ ещё не выдан».

Лимит: **7 активных** слотов (`active: true`).

Список:

```bash
curl -H "X-Admin-Key: $ADMIN_API_KEY" "https://<backend>/admin/amnezia-access"
```

Удаление:

```bash
curl -X DELETE -H "X-Admin-Key: $ADMIN_API_KEY" "https://<backend>/admin/amnezia-access/123456789"
```

## 4. Поведение в боте

- Остальные пользователи **не видят** кнопку Amnezia.  
- Frosty VLESS / Happ — без изменений.  
- **Массовых рассылок** при обновлении ключей нет.

## 5. Переменные окружения (опционально)

```env
AMNEZIA_SERVER_IP=138.124.80.97
AMNEZIA_APP_URL=https://amnezia.org/ru
```
