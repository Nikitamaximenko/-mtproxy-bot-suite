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

## Ссылки для Happ (Hit-style)

Подключение по **домену**, SNI = тот же домен, `fp=firefox` (не голый IP + microsoft.com).

```
vless://UUID@138-124-80-97.sslip.io:443?type=tcp&encryption=none&security=reality&sni=138-124-80-97.sslip.io&fp=firefox&pbk=...&sid=...&flow=xtls-rprx-vision#FrostyVPN
```

При смене домена: `bash scripts/vps-reality-hit-style.sh` и `POST /admin/refresh-vpn-links?notify=true`.

## Восстановление после правок

```bash
bash /opt/frostyvpn/scripts/vps-frosty-only-restore.sh
systemctl restart frostyvpn-backend
curl -X POST -H "x-admin-key: $ADMIN" "http://127.0.0.1:8000/admin/refresh-vpn-links?notify=false"
```
