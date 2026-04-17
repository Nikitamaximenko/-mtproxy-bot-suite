import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Manrope } from "next/font/google"
import { articles } from "../articles"
import { SITE_URL } from "@/lib/site"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"] })

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = articles.find((a) => a.slug === slug)
  if (!article) return {}
  const url = `${SITE_URL}/blog/${article.slug}`
  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords.join(", "),
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: "article",
      siteName: "Frosty",
      locale: "ru_RU",
      publishedTime: article.publishedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = articles.find((a) => a.slug === slug)
  if (!article) notFound()

  const url = `${SITE_URL}/blog/${article.slug}`

  // Related: ближайшие по дате статьи, без текущей
  const related = articles
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4)

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    keywords: article.keywords.join(", "),
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    inLanguage: "ru-RU",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "Frosty", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Frosty",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-light-32x32.png`,
      },
    },
    image: [`${url}/opengraph-image`],
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ],
  }

  return (
    <div className={manrope.className} style={{ background: "#FFFFFF", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <style>{`
        .article-content h1 { font-size:28px;font-weight:700;color:#111827;margin:0 0 16px }
        .article-content h2 { font-size:20px;font-weight:700;color:#111827;margin:32px 0 12px }
        .article-content h3 { font-size:17px;font-weight:700;color:#111827;margin:24px 0 8px }
        .article-content p { font-size:16px;color:#374151;line-height:1.7;margin:0 0 16px }
        .article-content ul { margin:0 0 16px;padding-left:24px }
        .article-content li { font-size:16px;color:#374151;line-height:1.7;margin-bottom:8px }
        .article-content a { color:#2AABEE }
        .article-content code { background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:14px }
        .article-content strong { color:#111827 }
      `}</style>

      <div style={{ borderBottom: "1px solid #F3F4F6", padding: "16px 24px" }}>
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ textDecoration: "none", fontWeight: 700, fontSize: "18px", color: "#111827" }}>
            ❄️ Frosty
          </Link>
          <Link href="/blog" style={{ color: "#6B7280", fontSize: "14px", textDecoration: "none" }}>
            ← Все статьи
          </Link>
        </div>
      </div>

      <article style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px" }}>
        <nav aria-label="breadcrumb" style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "24px" }}>
          <Link href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Главная
          </Link>
          {" → "}
          <Link href="/blog" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Блог
          </Link>
          {" → "}
          <span>{article.title}</span>
        </nav>

        <div style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}>
          {formatDate(article.publishedAt)}
        </div>

        <div
          className="article-content"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <div
          style={{
            marginTop: "48px",
            padding: "24px",
            background: "#F0F9FF",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>❄️</div>
          <div style={{ fontWeight: 700, fontSize: "18px", color: "#111827", marginBottom: "8px" }}>
            Frosty — личный прокси + VPN для Telegram
          </div>
          <div style={{ color: "#6B7280", fontSize: "14px", marginBottom: "20px" }}>
            299 ₽/мес · Instagram, YouTube, TikTok, ChatGPT · Работает на iOS, Android, Windows, Mac
          </div>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "#2AABEE",
              color: "white",
              padding: "14px 32px",
              borderRadius: "14px",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "16px",
            }}
          >
            Подключить за 299 ₽ →
          </Link>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: "48px" }}>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#111827",
                margin: "0 0 16px",
              }}
            >
              Читайте также
            </h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "12px",
                      padding: "16px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#111827",
                        margin: "0 0 4px",
                      }}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
                      {r.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
