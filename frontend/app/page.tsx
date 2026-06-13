import type { Metadata } from "next"
import { Landing } from "@/components/Landing"
import { SITE_URL } from "@/lib/site"

const PRICE_RUB = 299

export const metadata: Metadata = {
  title: "Frosty — личный VPN для Telegram, Instagram, YouTube (299 ₽/мес)",
  description:
    "Персональный VPN и быстрый VPN для Instagram, TikTok, YouTube и ChatGPT в одной подписке. Работает в России без рекламы и логов. 299 ₽ в месяц, подключение за минуту.",
  keywords: [
    "vpn",
    "личный vpn",
    "VPN для Telegram",
    "vpn telegram россия",
    "vpn для россии",
    "vpn для instagram",
    "vpn для youtube",
    "vpn для tiktok",
    "vpn для chatgpt",
    "обход блокировки telegram",
    "обход блокировки instagram",
    "vpn 2025 россия",
    "vless reality",
    "happ vpn",
    "frosty vpn",
  ].join(", "),
  authors: [{ name: "Frosty", url: SITE_URL }],
  creator: "Frosty",
  publisher: "Frosty",
  category: "technology",
  openGraph: {
    title: "Frosty — VPN в одной подписке за 299 ₽",
    description:
      "Telegram, Instagram, TikTok, YouTube, ChatGPT работают как до 2022 года. Личный сервер, без логов, подключение за минуту.",
    url: SITE_URL,
    siteName: "Frosty",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Frosty — VPN для Telegram и соцсетей",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Frosty — VPN в одной подписке",
    description:
      "Персональный VPN и VPN для Instagram, YouTube, TikTok. 299 ₽/мес.",
    images: [`${SITE_URL}/opengraph-image`],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
}

const faqEntries: Array<{ q: string; a: string }> = [
  {
    q: "Что входит в подписку Frosty?",
    a: "VPN на протоколе VLESS Reality через приложение Happ. Один профиль открывает Telegram, Instagram, TikTok, YouTube, ChatGPT и любые заблокированные сайты. До 10 устройств на одной подписке.",
  },
  {
    q: "На сколько устройств работает одна подписка?",
    a: "VPN-профиль можно добавить на несколько устройств одновременно (телефон + ноутбук + планшет) — до 10 штук.",
  },
  {
    q: "Нужен ли Telegram, чтобы купить?",
    a: "Нет. Оплачиваете на сайте банковской картой, на email приходит чек. Чтобы получить кнопку «Подключить VPN» — откройте нашего бота в Telegram из письма: подписка привяжется автоматически.",
  },
  {
    q: "Какие способы оплаты?",
    a: "Банковские карты (Visa / Mastercard / МИР). Подписка — 299 ₽/мес, без скрытых комиссий, продление или отмена по вашему желанию.",
  },
  {
    q: "Можно сначала попробовать бесплатно?",
    a: "Да. В Telegram-боте есть один бесплатный день, чтобы проверить VPN на ваших устройствах и операторе перед оплатой.",
  },
  {
    q: "Вы пишете логи моего трафика?",
    a: "Нет. Мы храним только то, что нужно для работы: Telegram ID или email, статус и даты подписки. Что именно вы открываете через VPN — мы не видим и не пишем.",
  },
  {
    q: "Что если не работает или что-то сломалось?",
    a: "Напишите в бот команду /support — ИИ-поддержка отвечает сразу, сложные вопросы берёт живой админ. Если не сможем починить — вернём деньги.",
  },
]

export default function HomePage() {
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Frosty — VPN",
    image: [`${SITE_URL}/opengraph-image`],
    description:
      "Личный VPN и VPN (VLESS Reality) для Instagram, TikTok, YouTube, ChatGPT. Персональный сервер, без логов.",
    brand: { "@type": "Brand", name: "Frosty" },
    offers: {
      "@type": "Offer",
      url: SITE_URL,
      priceCurrency: "RUB",
      price: PRICE_RUB,
      availability: "https://schema.org/InStock",
      priceValidUntil: "2030-12-31",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "128",
      bestRating: "5",
    },
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Landing />
    </>
  )
}
