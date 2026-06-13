import type { Metadata } from "next"
import Link from "next/link"
import { articles } from "./articles"
import { SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Блог Frosty — Telegram, VPN в России",
  description:
    "75+ гайдов, топов и разборов мифов про Telegram, VPN в России: регионы, Happ, YouTube, Instagram, ChatGPT.",
  keywords: [
    "блог telegram",
    "vpn гайды",
    "vpn россия гайд",
    "настройка vpn телеграм",
    "обход блокировки instagram",
    "vpn для youtube",
    "telegram москва",
    "telegram спб",
  ].join(", "),
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Блог Frosty — Telegram, VPN в России",
    description: "Гайды и разборы про Telegram, VPN в России.",
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
    <div className="font-sans antialiased" style={{ background: "#FFFFFF", minHeight: "100vh" }}>
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
          Блог Frosty — Telegram, VPN в России
        </h1>
        <p style={{ color: "#6B7280", fontSize: "16px", margin: "0 0 24px", lineHeight: 1.6 }}>
          {articles.length} статей: гайды, топы, мифы и региональные инструкции для России. VPN,
          Happ, YouTube, Instagram — без воды.
        </p>
        <p style={{ margin: "0 0 40px" }}>
          <a
            href="/blog/rss.xml"
            style={{ color: "#2AABEE", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
          >
            RSS-лента →
          </a>
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
