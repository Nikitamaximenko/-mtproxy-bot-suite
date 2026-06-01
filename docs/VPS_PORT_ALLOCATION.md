# Порты VPS Frosty (`138.124.80.97`)

**klodbot переехал на отдельный сервер.** На этом VPS только Frosty.

## Схема

```
Интернет → :443 → xray VLESS Reality (Frosty VPN, Happ)
         → :8443 / :9443 → nginx (API Frosty, ЮKassa)
         → :3568/udp → AmneziaWG (отдельная ветка)
```

## Правила

| Сервис | Порт |
|--------|------|
| **VPN (xray)** | **443** (основной) + **2053** (резерв, обход DPI на Wi‑Fi) |
| Frosty API | 9443, 8443 |
| Amnezia | 3568/udp |

**Не использовать** nginx stream на 443 и порт 10443 в ссылках — это было для совместного хостинга с klodbot.

## Ссылки для Happ

```
vless://UUID@138.124.80.97:443?type=tcp&encryption=none&security=reality&sni=www.microsoft.com&fp=chrome&pbk=...&sid=...&flow=xtls-rprx-vision#FrostyVPN
```

## Восстановление после правок

```bash
bash /opt/frostyvpn/scripts/vps-frosty-only-restore.sh
systemctl restart frostyvpn-backend
curl -X POST -H "x-admin-key: $ADMIN" "http://127.0.0.1:8000/admin/refresh-vpn-links?notify=false"
```
