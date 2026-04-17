import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import Link from "next/link"
import { articles } from "./articles"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"] })

const SITE_URL = "https://frostybot.ru"

export const metadata: Metadata = {
  title: "Блог Frosty — Telegram, MTProxy и VPN в России",
  description:
    "Гайды и разборы про обход блокировок Telegram, настройку MTProxy на iOS и Android, VPN для Instagram, YouTube, TikTok и ChatGPT в 2025 году.",
  keywords: [
    "блог telegram",
    "mtproxy гайды",
    "vpn россия гайд",
    "настройка прокси телеграм",
    "обход блокировки instagram",
    "vpn для youtube",
  ].join(", "),
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Блог Frosty — Telegram, MTProxy и VPN в России",
    description: "Гайды и разборы про Telegram, MTProxy и VPN в России.",
    url: `${SITE_URL}/blog`,
    siteName: "Frosty",
    locale: "ru_RU",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function BlogPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/blog/${a.slug}`,
      name: a.title,
    })),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
    ],
  }

  return (
    <div
      className={manrope.className}
      style={{ background: "#FFFFFF", minHeight: "100vh" }}
    >
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div style={{ borderBottom: "1px solid #F3F4F6", padding: "16px 24px" }}>
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{ textDecoration: "none", fontWeight: 700, fontSize: "18px", color: "#111827" }}
          >
            ❄️ Frosty
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "#2AABEE",
              color: "white",
              padding: "8px 18px",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            Подключить за 299 ₽ →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>
        <nav
          aria-label="breadcrumb"
          style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}
        >
          <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Главная
          </Link>
          {" → "}
          <span>Блог</span>
        </nav>

        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 8px",
          }}
        >
          Блог Frosty — Telegram, прокси и VPN в России
        </h1>
        <p style={{ color: "#6B7280", fontSize: "16px", margin: "0 0 40px", lineHeight: 1.6 }}>
          Объясняем как работает MTProxy, какой VPN выбрать в 2025 году, как починить Telegram,
          Instagram и YouTube в России. Без воды и партнёрских ссылок.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "16px",
                  padding: "24px",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "8px" }}>
                  {formatDate(article.publishedAt)}
                </div>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#111827",
                    margin: "0 0 8px",
                    lineHeight: "1.4",
                  }}
                >
                  {article.title}
                </h2>
                <p style={{ fontSize: "15px", color: "#6B7280", margin: "0 0 16px", lineHeight: "1.6" }}>
                  {article.description}
                </p>
                <span style={{ fontSize: "14px", color: "#2AABEE", fontWeight: 600 }}>
                  Читать →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
