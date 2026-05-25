#!/usr/bin/env node
/**
 * Generates frontend/app/blog/articles-batch-2026.ts — 50 SEO articles for frostybot.ru/blog
 */
import { writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "../frontend/app/blog/articles-batch-2026.ts")

const regions = [
  { slug: "telegram-ne-rabotaet-moskva-2026", city: "Москве", region: "Москва и МО", operators: "МТС, Билайн, МегаФон, Yota, домашний интернет Ростелеком и МГТС", note: "В столице чаще всего замедляют медиа в Telegram через ТСПУ, а не полностью блокируют приложение." },
  { slug: "telegram-ne-rabotaet-spb-2026", city: "Санкт-Петербурге", region: "Санкт-Петербург и Ленобласть", operators: "Ростелеком, МТС, Билайн, МегаФон, Дом.ру", note: "В СПб типичная жалоба — «кружки не грузятся», при этом текстовые чаты работают." },
  { slug: "telegram-krasnodar-vpn-gajd-2026", city: "Краснодаре", region: "Краснодарский край", operators: "Ростелеком, МТС, МегаФон, ТТК", note: "На юге России много мобильного трафика — VPN на телефоне критичен в поездках между городами." },
  { slug: "vpn-telegram-ekaterinburg-2026", city: "Екатеринбурге", region: "Свердловская область", operators: "Дом.ру, Ростелеком, МТС, Билайн", note: "Уральский регион: домашний Wi‑Fi обычно стабильнее мобильного для звонков в Telegram." },
  { slug: "obhod-blokirovok-novosibirsk-2026", city: "Новосибирске", region: "Новосибирская область", operators: "Ростелеком, МТС, МегаФон, Билайн", note: "В Сибири заметны периодические просадки скорости у операторов в вечерние часы." },
  { slug: "telegram-kazan-mtproxy-2026", city: "Казани", region: "Республика Татарстан", operators: "Ростелеком, МТС, МегаФон, Letai", note: "В Татарстане популярен Telegram для бизнес-каналов — стабильный MTProxy важен для SMM и поддержки." },
  { slug: "vpn-rostov-telegram-2026", city: "Ростове-на-Дону", region: "Ростовская область", operators: "Ростелеком, МТС, Билайн, МегаФон", note: "На юге часто жалуются на нестабильную загрузку Stories и видео в Telegram." },
  { slug: "telegram-samara-gajd-2026", city: "Самаре", region: "Самарская область", operators: "Ростелеком, МТС, МегаФон, Билайн", note: "В Самаре хорошо работает связка MTProxy для Telegram + VPN для Instagram/YouTube." },
  { slug: "vpn-voronezh-telegram-2026", city: "Воронеже", region: "Воронежская область", operators: "Ростелеком, МТС, Билайн", note: "Центральный Чернозёмье: проверяйте прокси отдельно на Wi‑Fi и на мобильной сети." },
  { slug: "telegram-nizhnij-novgorod-2026", city: "Нижнем Новгороде", region: "Нижегородская область", operators: "Ростелеком, МТС, МегаФон, Билайн", note: "В Нижнем часто помогает смена DNS + MTProxy, если медиа «висят» на одном операторе." },
]

function regionalArticle(r, date) {
  return {
    slug: r.slug,
    title: `Telegram не работает в ${r.city}: что делать в 2026 году`,
    description: `Пошаговый гайд для ${r.region}: как восстановить Telegram, звонки и медиа через MTProxy и VPN. Операторы ${r.operators}.`,
    keywords: [`telegram ${r.region.toLowerCase()}`, `vpn ${r.city.toLowerCase()}`, "mtproxy telegram", "телеграм не работает", r.region.split(" ")[0].toLowerCase()],
    publishedAt: date,
    content: `
<h1>Telegram не работает в ${r.city}: что делать в 2026 году</h1>

<p>Жители ${r.region} регулярно сталкиваются с тем, что Telegram «тормозит»: не открываются фото, обрываются звонки, долго грузятся каналы. ${r.note} Ниже — рабочие способы для региона без лишней теории.</p>

<h2>Типичные симптомы в ${r.city}</h2>
<ul>
  <li>Сообщения отправляются, но медиа не скачивается</li>
  <li>Голосовые и видеозвонки не соединяются</li>
  <li>На одном операторе работает, на другом — нет</li>
  <li>Через Wi‑Fi лучше, чем через мобильный интернет (или наоборот)</li>
</ul>

<h2>Популярные операторы: ${r.operators}</h2>
<p>Если проблема только на мобильной сети — попробуйте Wi‑Fi или другую SIM. Если ломается везде — нужен MTProxy или VPN, а не смена тарифа.</p>

<h2>Способ 1: MTProxy внутри Telegram</h2>
<p>Откройте Настройки → Данные и память → Прокси → MTProto. Личный прокси не перегружен публичными списками и стабильнее для ${r.region}.</p>
<ol>
  <li>Получите ссылку <code>tg://proxy?...</code> у надёжного провайдера</li>
  <li>Нажмите на ссылку в Telegram — прокси добавится автоматически</li>
  <li>Проверьте загрузку видео в любом канале</li>
</ol>

<h2>Способ 2: VPN (Happ) для медиа и других сервисов</h2>
<p>MTProxy ускоряет сам Telegram. Для Instagram, YouTube, TikTok, ChatGPT удобнее VPN-клиент Happ с VLESS-подключением — один профиль на телефоне.</p>

<h2>Чеклист для ${r.city}</h2>
<ul>
  <li>Обновите Telegram до последней версии</li>
  <li>Отключите «Экономия трафика» в настройках</li>
  <li>Проверьте прокси на Wi‑Fi и LTE отдельно</li>
  <li>Не используйте перегруженные бесплатные прокси из каналов</li>
</ul>

<h2>Итог</h2>
<p>Для ${r.region} оптимальная связка — <strong>MTProxy для Telegram</strong> + <strong>VPN для остального интернета</strong>. Frosty даёт оба инструмента в одной подписке за 299 ₽/мес.</p>
`,
  }
}

const tops = [
  { slug: "top-10-sposobov-uskorit-telegram-2026", title: "Топ-10 способов ускорить Telegram в России в 2026", desc: "Подборка рабочих методов: MTProxy, VPN, DNS, смена сети и настройки приложения.", kw: ["ускорить telegram", "telegram тормозит", "топ способов telegram"] },
  { slug: "top-7-vpn-dlya-rossii-2026", title: "Топ-7 VPN для России в 2026: честное сравнение", desc: "Критерии выбора VPN в РФ: скорость, обход блокировок, цена, поддержка VLESS и MTProxy.", kw: ["лучший vpn россия", "vpn 2026", "топ vpn"] },
  { slug: "top-5-prilozhenij-obhod-blokirovok", title: "Топ-5 приложений для обхода блокировок в 2026", desc: "Happ, Telegram Proxy, браузеры с VPN, WireGuard-клиенты — что реально работает в РФ.", kw: ["приложения обход блокировок", "happ vpn", "mtproxy"] },
  { slug: "top-mifov-o-vpn-v-rossii", title: "Топ-8 мифов о VPN в России, в которые все верят", desc: "Разбираем популярные заблуждения: легальность, скорость, бесплатные сервисы, анонимность.", kw: ["мифы vpn", "vpn россия мифы", "закон vpn"] },
  { slug: "top-oshibok-nastrojki-mtproxy", title: "Топ-7 ошибок при настройке MTProxy в Telegram", desc: "Неверный секрет, публичный перегруженный прокси, конфликт с VPN — типичные ошибки новичков.", kw: ["ошибки mtproxy", "настройка прокси telegram", "mtproxy не работает"] },
  { slug: "top-operatorov-tormozyat-telegram", title: "Топ операторов, у которых чаще тормозит Telegram", desc: "Как мобильные и домашние провайдеры применяют ТСПУ и что делать абоненту.", kw: ["оператор telegram тормозит", "тспу telegram", "мтс телеграм"] },
  { slug: "top-sposobov-smotret-youtube-rf", title: "Топ-6 способов смотреть YouTube в России в 2026", desc: "VPN, Smart DNS, браузерные расширения, роутер — сравниваем скорость и стабильность.", kw: ["youtube россия 2026", "как смотреть youtube", "vpn youtube"] },
  { slug: "top-alternativ-instagram-rf", title: "Топ альтернатив Instagram для пользователей из РФ", desc: "VPN, PWA, VK Клипы, Telegram-каналы — где смотреть контент, если Instagram недоступен.", kw: ["instagram россия альтернативы", "instagram vpn", "как зайти в instagram"] },
  { slug: "podborka-nastroek-happ-2026", title: "Подборка настроек Happ для Android и iPhone в 2026", desc: "Импорт VLESS, автообновление подписки, split tunneling и проверка пинга.", kw: ["happ настройка", "happ vpn android", "happ ios"] },
  { slug: "top-reshenij-chatgpt-rossiya", title: "Топ решений для ChatGPT из России без иностранной карты", desc: "VPN, зеркала, API через прокси — что работает в 2026 и чего избегать.", kw: ["chatgpt россия", "vpn chatgpt", "chatgpt 2026"] },
  { slug: "top-prichin-medlennogo-telegram", title: "Топ-5 причин, почему Telegram медленно грузит медиа", desc: "ТСПУ, перегруженный прокси, старая версия приложения, VPN поверх VPN, плохой DNS.", kw: ["telegram медленно", "не грузятся фото telegram", "telegram тормозит"] },
  { slug: "top-besplatnyh-proksi-minusy", title: "Топ минусов бесплатных прокси Telegram", desc: "Почему публичные MTProxy из каналов — плохая идея для постоянного использования.", kw: ["бесплатный прокси telegram", "публичный mtproxy", "опасность прокси"] },
]

function topArticle(t, date, idx) {
  const items = [
    "Личный MTProxy вместо публичного списка",
    "VPN с протоколом VLESS Reality",
    "Смена DNS на Cloudflare или Google",
    "Обновление Telegram до последней версии",
    "Отключение режима экономии трафика",
    "Проверка на Wi‑Fi и мобильной сети отдельно",
    "Использование Happ с автообновлением конфига",
    "Split routing: .ru сайты напрямую, остальное через VPN",
    "Роутер с VPN для всей квартиры",
    "Отказ от «VPN поверх VPN»",
  ]
  const list = items.slice(0, 5 + (idx % 5)).map((x, i) => `<li><strong>${i + 1}.</strong> ${x}</li>`).join("\n")
  return {
    slug: t.slug,
    title: t.title,
    description: t.desc,
    keywords: t.kw,
    publishedAt: date,
    content: `
<h1>${t.title}</h1>
<p>${t.desc} Материал адаптирован под реалии России 2026 года: блокировки, ТСПУ, мобильные операторы и домашний интернет.</p>

<h2>Краткий вывод</h2>
<p>Для большинства пользователей в РФ оптимальна связка <strong>MTProxy для Telegram</strong> + <strong>VPN для заблокированных сервисов</strong>. Бесплатные публичные прокси подходят только для разовой проверки.</p>

<h2>Подборка</h2>
<ol>${list}</ol>

<h2>Как выбрать свой вариант</h2>
<p>Если ломается только Telegram — начните с MTProxy. Если нужны Instagram, YouTube, TikTok, ChatGPT — добавьте VPN. Frosty объединяет оба инструмента в одной подписке (299 ₽/мес).</p>

<h2>Чего избегать</h2>
<ul>
  <li>Бесплатные VPN с рекламой и продажей логов</li>
  <li>Публичные прокси на тысячи пользователей</li>
  <li>Устаревшие протоколы без маскировки трафика</li>
</ul>

<h2>Итог</h2>
<p>Используйте проверенные решения с поддержкой и стабильной скоростью — это дешевле, чем каждый раз искать новый «рабочий» прокси в каналах.</p>
`,
  }
}

const myths = [
  { slug: "mif-vpn-nelegalen-v-rossii", title: "Миф: VPN в России полностью запрещён", claim: "VPN незаконен для обычных пользователей", truth: "Использование VPN физлицами не запрещено; ограничения касаются в основном операторов связи и публичных сервисов, не соблюдающих требования." },
  { slug: "mif-besplatnyj-proxy-bezopasen", title: "Миф: бесплатный MTProxy безопасен", claim: "Раз прокси бесплатный — можно пользоваться постоянно", truth: "Владелец видит метаданные соединений; перегрузка снижает скорость; прокси могут подменять или логировать трафик." },
  { slug: "mif-mtproxy-zamenyaet-vpn", title: "Миф: MTProxy полностью заменяет VPN", claim: "Достаточно прокси Telegram — VPN не нужен", truth: "MTProxy работает только внутри Telegram. Instagram, YouTube, TikTok, ChatGPT требуют VPN или другого туннеля." },
  { slug: "mif-telegram-polnostyu-zablokirovan", title: "Миф: Telegram в России полностью заблокирован", claim: "Telegram не работает нигде", truth: "Чаще применяют замедление (ТСПУ), а не полную блокировку. MTProxy и VPN восстанавливают нормальную скорость." },
  { slug: "mif-vpn-tormozit-internet", title: "Миф: любой VPN всегда сильно тормозит", claim: "VPN делает интернет в 10 раз медленнее", truth: "Современные протоколы (VLESS Reality) дают 80–95% скорости канала; тормозит перегруженный или далёкий сервер." },
  { slug: "mif-proksi-vidit-soobsheniya", title: "Миф: прокси-владелец читает ваши сообщения", claim: "Через MTProxy видны все переписки", truth: "Telegram шифрует сообщения end-to-end в секретных чатах; прокси видит только факт соединения с серверами Telegram." },
  { slug: "mif-nuzhen-inostrannyj-nomer", title: "Миф: для VPN нужен иностранный номер телефона", claim: "Без зарубежной SIM VPN не подключить", truth: "Frosty и большинство сервисов регистрируются через Telegram — российский номер подходит." },
  { slug: "mif-vpn-rabotaet-vsegda", title: "Миф: один VPN работает вечно без смены", claim: "Купил VPN — забыл на год", truth: "IP-адреса блокируют; нужны протоколы с маскировкой и автообновление конфигурации (Happ subscription)." },
  { slug: "mif-tor-luchshe-vpn", title: "Миф: Tor всегда лучше VPN для Telegram", claim: "Tor быстрее и надёжнее", truth: "Tor медленный для видео и звонков; для мессенджера VPN или MTProxy практичнее." },
  { slug: "mif-platnyj-vpn-garantiya", title: "Миф: платный VPN = 100% анонимность", claim: "Заплатил — никто не видит", truth: "Анонимность зависит от политики логов, юрисдикции и ваших действий; 100% гарантии не бывает." },
]

function mythArticle(m, date) {
  return {
    slug: m.slug,
    title: m.title,
    description: `Разбираем миф: «${m.claim}». Факты для пользователей из России в 2026 году.`,
    keywords: ["миф vpn", "vpn россия", m.slug.replace(/-/g, " ")],
    publishedAt: date,
    content: `
<h1>${m.title}</h1>

<h2>Миф</h2>
<p><em>«${m.claim}»</em></p>

<h2>Реальность</h2>
<p>${m.truth}</p>

<h2>Почему миф живёт</h2>
<p>Форумы и Telegram-каналы повторяют устаревшую информацию 2018–2022 годов. Технологии и регулирование изменились: ТСПУ, VLESS Reality, встроенный MTProxy.</p>

<h2>Что делать на практике</h2>
<ul>
  <li>Используйте личный MTProxy для Telegram</li>
  <li>Для других сервисов — VPN с современным протоколом</li>
  <li>Не верьте «волшебным бесплатным» спискам прокси</li>
</ul>

<h2>Итог</h2>
<p>Опирайтесь на проверенные решения с понятной поддержкой — Frosty даёт MTProxy + VPN за 299 ₽/мес без мифов про «100% анонимность».</p>
`,
  }
}

const guides = [
  { slug: "gaid-happ-s-nulya-2026", title: "Гайд: настройка Happ VPN с нуля на iPhone и Android", topic: "Happ", steps: ["Скачайте Happ из App Store или Google Play", "Получите VLESS-ссылку или subscription URL в боте Frosty", "Нажмите «+» → «Вставить из буфера»", "Включите профиль и проверьте пинг", "Включите автообновление подписки"] },
  { slug: "gaid-mtproxy-desktop-2026", title: "Гайд: MTProxy на Windows и macOS в 2026", topic: "MTProxy Desktop", steps: ["Откройте Telegram Desktop → Настройки → Продвинутые → Прокси", "Добавьте MTProto прокси", "Вставьте ссылку tg://proxy от Frosty", "Проверьте синхронизацию медиа", "Не включайте системный VPN поверх, если не нужен"] },
  { slug: "gaid-telegram-dlya-biznesa-rf", title: "Гайд: Telegram для бизнеса в России — стабильный доступ", topic: "B2B Telegram", steps: ["Выделите личный MTProxy для команды", "Настройте резервный VPN на телефонах менеджеров", "Проверьте работу ботов и CRM-интеграций", "Документируйте инструкцию для новых сотрудников", "Мониторьте скорость загрузки медиа"] },
  { slug: "gaid-obhod-tspu-2026", title: "Гайд: что такое ТСПУ и как обойти замедление", topic: "ТСПУ", steps: ["Поймите, что ТСПУ фильтрует по DPI, а не только по IP", "Используйте MTProxy с маскировкой трафика", "VLESS Reality для VPN — трафик похож на обычный HTTPS", "Избегайте устаревших OpenVPN без obfuscation", "Тестируйте скорость до и после подключения"] },
  { slug: "gaid-vpn-dlya-poezdok-po-rossii", title: "Гайд: VPN и Telegram в поездках по России", topic: "Поездки", steps: ["Сохраните конфиг Happ офлайн", "Проверьте работу на LTE разных операторов", "MTProxy в Telegram не требует отдельного приложения", "На поезде Wi‑Fi может быть медленным — держите мобильный запасной", "Не раздавайте VPN на всех попутчиков — лимит устройств"] },
  { slug: "gaid-telegram-ipad-2026", title: "Гайд: настройка прокси Telegram на iPad", topic: "iPad", steps: ["Обновите Telegram из App Store", "Настройки → Данные и память → Прокси", "Добавьте MTProto по ссылке", "Для Safari/Instagram используйте Happ", "Проверьте Split Tunneling если доступен"] },
  { slug: "gaid-smena-operatora-telegram", title: "Гайд: Telegram перестал работать после смены оператора", topic: "Смена оператора", steps: ["Сбросьте настройки APN (Android) или переустановите профиль (iOS)", "Проверьте прокси — старый мог быть привязан к другой сети", "Сравните Wi‑Fi и LTE", "Обратитесь в поддержку Frosty если MTProxy не коннектится", "Не используйте публичные DNS оператора с фильтрацией"] },
  { slug: "gaid-vpn-android-tv-2026", title: "Гайд: VPN на Android TV и Smart TV в России", topic: "Smart TV", steps: ["Установите VPN-клиент из Google Play на TV-приложение", "Импортируйте конфиг с телефона", "Альтернатива: VPN на роутере Keenetic/OpenWRT", "YouTube и стриминги через VPN", "Telegram на TV — через отдельное приложение или Cast"] },
  { slug: "gaid-vless-vs-wireguard", title: "Гайд: VLESS Reality vs WireGuard — что выбрать в РФ", topic: "Протоколы", steps: ["WireGuard быстрый, но легко детектируется DPI", "VLESS Reality маскируется под обычный сайт", "В России для обхода блокировок Reality предпочтительнее", "Happ поддерживает оба — начните с VLESS", "WireGuard оставьте для LAN и домашней сети"] },
  { slug: "gaid-esli-zablokirovali-vpn", title: "Гайд: что делать, если заблокировали VPN-сервер", topic: "Блокировка VPN", steps: ["Запросите новый конфиг у провайдера (Frosty обновляет автоматически)", "Используйте subscription URL в Happ", "Смените порт подключения если доступен альтернативный", "Не паникуйте — MTProxy для Telegram может работать отдельно", "Избегайте публичных «списков серверов»"] },
  { slug: "gaid-telegram-krym-2026", title: "Гайд: Telegram и VPN в Крыму в 2026", topic: "Крым", steps: ["Проверьте работу на местных операторах и Wi‑Fi", "MTProxy стабилен для мессенджера", "VPN нужен для Instagram/YouTube", "Сохраните конфиг до поездки", "Frosty работает по всей РФ включая новые регионы"] },
  { slug: "gaid-bezopasnost-vpn-rossiya", title: "Гайд: безопасность VPN для пользователя из России", topic: "Безопасность", steps: ["Не вводите пароли на фишинговых «бесплатных VPN»", "Используйте официальные приложения из Store", "Включайте автообновления", "Не передавайте VLESS-ссылку посторонним", "Разделяйте рабочий и личный профили"] },
  { slug: "gaid-vpn-dlya-studenta-2026", title: "Гайд: VPN для студента в России — Telegram, YouTube, учёба", topic: "Студенты", steps: ["299 ₽/мес — дешевле кофе в неделю", "MTProxy для чатов группы", "VPN для Coursera, YouTube, зарубежных ресурсов", "Happ на ноутбук и телефон", "Не используйте торренты через рабочий VPN профиль"] },
  { slug: "gaid-netflix-v-rossii-2026", title: "Гайд: как смотреть Netflix из России в 2026", topic: "Netflix", steps: ["Netflix блокирует по IP — нужен VPN", "Выберите сервер с низким пингом", "Happ или браузер с VPN на ПК", "Оплата — отдельная тема (зарубежные карты)", "Split routing чтобы .ru банки работали напрямую"] },
  { slug: "gaid-linkedin-v-rossii-2026", title: "Гайд: LinkedIn из России через VPN в 2026", topic: "LinkedIn", steps: ["LinkedIn недоступен без VPN", "VLESS через Happ на телефоне", "На ПК — системный VPN или расширение", "Не нарушайте ToS LinkedIn", "Используйте стабильный сервер, не бесплатный"] },
  { slug: "gaid-whatsapp-vs-telegram", title: "Гайд: WhatsApp vs Telegram в России — что выбрать", topic: "Мессенджеры", steps: ["Telegram популярнее для каналов и ботов", "WhatsApp может требовать VPN в отдельных сетях", "MTProxy — преимущество Telegram", "Для семьи — тот мессенджер, где все на связи", "Frosty оптимизирован под Telegram"] },
  { slug: "gaid-proverka-skorosti-mtproxy", title: "Гайд: как проверить скорость MTProxy", topic: "Скорость", steps: ["Скачайте большой файл в канале Telegram", "Засеките время до и после прокси", "Сравните с VPN отключённым (осторожно на нестабильной сети)", "Пинг в Happ — ориентир, не истина", "Смените прокси если < 1 Мбит/с на медиа"] },
  { slug: "gaid-migraciya-na-frosty", title: "Гайд: миграция с другого VPN на Frosty", topic: "Миграция", steps: ["Отключите старый VPN", "Подключите MTProxy в Telegram через бота", "Импортируйте VLESS в Happ", "Удалите старые профили чтобы не конфликтовали", "Проверьте Instagram/YouTube/TikTok"] },
]

function guideArticle(g, date) {
  const stepsHtml = g.steps.map((s, i) => `<li><strong>Шаг ${i + 1}.</strong> ${s}</li>`).join("\n")
  return {
    slug: g.slug,
    title: g.title,
    description: `Пошаговая инструкция: ${g.topic}. Адаптировано для пользователей из России, 2026 год.`,
    keywords: ["гайд", g.topic.toLowerCase(), "telegram россия", "vpn настройка"],
    publishedAt: date,
    content: `
<h1>${g.title}</h1>
<p>Подробный гайд по теме «${g.topic}» для жителей России. Без лишней теории — только шаги, которые работают в 2026 году.</p>

<h2>Кому подойдёт</h2>
<p>Новичкам и тем, кто уже пробовал публичные прокси, но не получил стабильный результат. Нужен Telegram, Instagram, YouTube или другие сервисы — инструкция универсальна.</p>

<h2>Пошаговая инструкция</h2>
<ol>${stepsHtml}</ol>

<h2>Частые ошибки</h2>
<ul>
  <li>Использование перегруженного бесплатного прокси</li>
  <li>Два VPN одновременно (конфликт маршрутов)</li>
  <li>Старая версия Telegram или Happ</li>
</ul>

<h2>Итог</h2>
<p>Frosty объединяет MTProxy и VPN — подключение через Telegram-бота за 30 секунд, 299 ₽/мес.</p>
`,
  }
}

// Build 50 articles with staggered dates Feb-May 2026
const all = []
let day = 1
function dateFor(n) {
  const m = 2 + Math.floor(n / 28)
  const d = (n % 28) + 1
  return `2026-${String(Math.min(m, 5)).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

regions.forEach((r, i) => all.push(regionalArticle(r, dateFor(i))))
tops.forEach((t, i) => all.push(topArticle(t, dateFor(10 + i), i)))
myths.forEach((m, i) => all.push(mythArticle(m, dateFor(22 + i))))
guides.forEach((g, i) => all.push(guideArticle(g, dateFor(32 + i))))

if (all.length !== 50) {
  console.error("Expected 50 articles, got", all.length)
  process.exit(1)
}

const body = all
  .map(
    (a) => `  {
    slug: ${JSON.stringify(a.slug)},
    title: ${JSON.stringify(a.title)},
    description: ${JSON.stringify(a.description)},
    keywords: ${JSON.stringify(a.keywords)},
    publishedAt: ${JSON.stringify(a.publishedAt)},
    content: \`
${a.content.trim()}
\${CTA}
\`,
  }`,
  )
  .join(",\n")

const ts = `import type { Article } from "./article-types"
import { CTA } from "./cta"

/** 50 SEO-статей: регионы РФ, топы, мифы, гайды — май 2026 */
export const articlesBatch2026: Article[] = [
${body}
]
`

writeFileSync(OUT, ts, "utf8")
console.log("Wrote", all.length, "articles to", OUT)
