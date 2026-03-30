"use client"
import Link from "next/link"
import { Manrope } from "next/font/google"
import { articles } from "./articles"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "600", "700"] })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

export default function BlogPage() {
  return (
    <div
      className={manrope.className}
      style={{ background: "#FFFFFF", minHeight: "100vh" }}
    >
      {/* Шапка */}
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
          <a
            href="/mini"
            style={{ textDecoration: "none", fontWeight: 700, fontSize: "18px", color: "#111827" }}
          >
            ❄️ Frosty
          </a>
          <a
            href="/mini"
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
          </a>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 8px",
          }}
        >
          Статьи о Telegram
        </h1>
        <p style={{ color: "#6B7280", fontSize: "16px", margin: "0 0 40px" }}>
          Полезные руководства по настройке и обходу блокировок
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
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = "#2AABEE"
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 4px 16px rgba(42,171,238,0.1)"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.borderColor = "#E5E7EB"
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = "none"
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
