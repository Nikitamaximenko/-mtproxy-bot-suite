"""
Домены и суффиксы для smart routing: российские приложения и сервисы → DIRECT (минуя VPN).

Покрывает топ популярных приложений в РФ, которые ломаются при полном туннеле:
Яндекс (Go, Еда, Лавка, Маркет, Карты), Самокат, каршеринг, банки, маркетплейсы и т.д.

Форматы:
- XRAY_DOMAINS: "domain:example.com" для Xray JSON
- CLASH_SUFFIXES: "example.com" для DOMAIN-SUFFIX rules
- SINGBOX_SUFFIXES: "example.com" для domain_suffix в sing-box
"""

from __future__ import annotations

# Non-.ru / CDN / API-хосты российских сервисов (не покрываются правилом .ru)
RU_NON_RU_SUFFIXES: tuple[str, ...] = (
    # ── Яндекс (экосистема) ───────────────────────────────────────────────
    "yandex.com",
    "yandex.net",
    "yandex.eu",
    "yandex.kz",
    "yandex.by",
    "yastatic.net",
    "yandexcloud.net",
    "yandex-team.ru",
    "dzen.ru",
    "beru.ru",
    "yandexgo.com",
    "yandexgo.ru",
    # ── VK / Mail.ru ──────────────────────────────────────────────────────
    "vk.com",
    "vk.me",
    "vk.ru",
    "userapi.com",
    "vk-cdn.net",
    "vkuseraudio.com",
    "vkuserlive.net",
    "mycdn.me",
    "imgsmail.ru",
    # ── Wildberries CDN ───────────────────────────────────────────────────
    "wbstatic.net",
    "wbbasket.ru",
    "wbimg.ru",
    # ── 2GIS ──────────────────────────────────────────────────────────────
    "2gis.com",
    "2gis.io",
    # ── Банки (non-.ru) ───────────────────────────────────────────────────
    "tbank.ru",
    "tinkoff.ru",
    "qiwi.com",
    # ── Стриминг ──────────────────────────────────────────────────────────
    "premier.one",
    "okko.tv",
    # ── Доставка еды / ритейл ─────────────────────────────────────────────
    "samokat.tech",
    "kuper.ru",
    "5ka.ru",
    "x5.ru",
    # ── Каршеринг / микромобильность ──────────────────────────────────────
    "whoosh.bike",
    "whoosh.zone",
    "urent.app",
    "urentbike.ru",
    "urent.ru",
    "city-mobil.ru",
    "citydrive.ru",
    "belkacar.ru",
    "delitime.ru",
    "anytime.ru",
    "carnow.ru",
    "rentride.ru",
    # ── Транспорт / авиа ──────────────────────────────────────────────────
    "aeroflot.ru",
    "rossiya-airlines.com",
    "pobeda.aero",
    # ── Прочие популярные non-.ru ─────────────────────────────────────────
    "avito.st",
    "ozon.by",
    "meduza.io",
    "habr.com",
)

# Явные .ru и смешанные домены (дублируют catch-all .ru, но надёжнее для DNS/routing)
RU_EXPLICIT_HOSTS: tuple[str, ...] = (
    # Яндекс сервисы
    "yandex.ru",
    "ya.ru",
    "go.yandex.ru",
    "taxi.yandex.ru",
    "eda.yandex.ru",
    "lavka.yandex.ru",
    "market.yandex.ru",
    "maps.yandex.ru",
    "music.yandex.ru",
    "disk.yandex.ru",
    "weather.yandex.ru",
    "afisha.yandex.ru",
    "auto.yandex.ru",
    "drive.yandex.ru",
    "travel.yandex.ru",
    "alice.yandex.ru",
    "yandexgo.ru",
    "yandexpay.ru",
    "yoomoney.ru",
    "money.yandex.ru",
    "kinopoisk.ru",
    "zen.yandex.ru",
    # Самокат / доставка
    "samokat.ru",
    "api.samokat.ru",
    "samokat.tech",
    "vkusvill.ru",
    "perekrestok.ru",
    "lenta.com",
    "magnit.ru",
    "metro-cc.ru",
    "kuper.ru",
    "sbermarket.ru",
    "boxberry.ru",
    "cdek.ru",
    "dpd.ru",
    "pochta.ru",
    # Маркетплейсы
    "wildberries.ru",
    "ozon.ru",
    "avito.ru",
    "lamoda.ru",
    "citilink.ru",
    "dns-shop.ru",
    "mvideo.ru",
    "eldorado.ru",
    "megamarket.ru",
    "sbermegamarket.ru",
    "leroymerlin.ru",
    "aliexpress.ru",
    # Банки
    "sberbank.ru",
    "sbrf.ru",
    "sber.ru",
    "domclick.ru",
    "tinkoff.ru",
    "tbank.ru",
    "alfabank.ru",
    "vtb.ru",
    "raiffeisen.ru",
    "gazprombank.ru",
    "gpb.ru",
    "pochtabank.ru",
    "sovcombank.ru",
    "open.ru",
    "mtsbank.ru",
    "nspk.ru",
    "mirpay.ru",
    "cloudpayments.ru",
    # Госуслуги
    "gosuslugi.ru",
    "esia.gosuslugi.ru",
    "nalog.ru",
    "mos.ru",
    "pfr.ru",
    "rosreestr.ru",
    "cbr.ru",
    # Соцсети
    "vk.com",
    "ok.ru",
    "mail.ru",
    "dzen.ru",
    # Медиа
    "ivi.ru",
    "rutube.ru",
    "start.ru",
    "more.tv",
    "kion.ru",
    # Карты
    "2gis.ru",
    # Транспорт
    "rzd.ru",
    "rzd-online.ru",
    "mosmetro.ru",
    "troika.ru",
    "aeroflot.ru",
    "s7.ru",
    "utair.ru",
    # Телеком
    "mts.ru",
    "megafon.ru",
    "beeline.ru",
    "tele2.ru",
    "rt.ru",
    "rostelecom.ru",
    "dom.ru",
    # Каршеринг
    "delimobil.ru",
    "city-mobil.ru",
    "belkacar.ru",
    "whoosh.bike",
    "urent.app",
    "delitime.ru",
    "anytime.ru",
    # Авто
    "auto.ru",
    "drom.ru",
    # Здоровье
    "emias.info",
    "prodoctorov.ru",
    "napopravku.ru",
    "zdravcity.ru",
    # Работа / медиа
    "hh.ru",
    "superjob.ru",
    "rbc.ru",
    "ria.ru",
    "lenta.ru",
    "gazeta.ru",
    "kommersant.ru",
    # Прочее
    "sportmaster.ru",
    "pikabu.ru",
    "pyaterochka.ru",
    "5ka.ru",
)

XRAY_DOMAINS: list[str] = [f"domain:{h}" for h in RU_EXPLICIT_HOSTS] + [
    f"domain:{s}" for s in RU_NON_RU_SUFFIXES
]

CLASH_SUFFIXES: list[str] = list(RU_NON_RU_SUFFIXES) + list(RU_EXPLICIT_HOSTS)

SINGBOX_EXTRA_SUFFIXES: list[str] = list(dict.fromkeys(RU_NON_RU_SUFFIXES + RU_EXPLICIT_HOSTS))

# Рекламные домены YouTube / Google Ads
AD_SUFFIXES: tuple[str, ...] = (
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "googletagservices.com",
    "adservice.google.com",
    "ads.youtube.com",
    "imasdk.googleapis.com",
)
