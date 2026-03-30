import { articles } from "../articles"
import { notFound } from "next/navigation"
import { Manrope } from "next/font/google"
import type { Metadata } from "next"

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
  return {
    title: article.title + " | Frosty",
    description: article.description,
    keywords: article.keywords.join(", "),
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://frostybot.ru/blog/${article.slug}`,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = articles.find((a) => a.slug === slug)
  if (!article) notFound()

  return (
    <div className={manrope.className} style={{ background: "#FFFFFF", minHeight: "100vh" }}>
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

      {/* Шапка */}
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
          <a
            href="/mini"
            style={{ textDecoration: "none", fontWeight: 700, fontSize: "18px", color: "#111827" }}
          >
            ❄️ Frosty
          </a>
          <a
            href="/blog"
            style={{ color: "#6B7280", fontSize: "14px", textDecoration: "none" }}
          >
            ← Все статьи
          </a>
        </div>
      </div>

      {/* Контент */}
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px" }}>
        {/* Хлебные крошки */}
        <div style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "24px" }}>
          <a href="/mini" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Главная
          </a>
          {" → "}
          <a href="/blog" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Блог
          </a>
          {" → "}
          <span>{article.title}</span>
        </div>

        <div style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}>
          {new Date(article.publishedAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>

        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Нижняя CTA */}
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
          <div
            style={{ fontWeight: 700, fontSize: "18px", color: "#111827", marginBottom: "8px" }}
          >
            Frosty — личный прокси для Telegram
          </div>
          <div style={{ color: "#6B7280", fontSize: "14px", marginBottom: "20px" }}>
            299 ₽/мес · Без VPN · Только ваш трафик · Работает на iOS и Android
          </div>
          <a
            href="/mini"
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
            Подключить прокси →
          </a>
        </div>
      </div>
    </div>
  )
}
