import { ImageResponse } from "next/og"
import { articles } from "../articles"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Frosty — статья о Telegram, прокси и VPN"

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = articles.find((a) => a.slug === slug)
  const title = article?.title ?? "Frosty"
  const date = article?.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          padding: 72,
          fontFamily: "sans-serif",
          color: "#111827",
          borderTop: "12px solid #2AABEE",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#2AABEE",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            ❄
          </div>
          <span>Frosty</span>
          <span style={{ color: "#6B7280", fontSize: 22, fontWeight: 500 }}>· Блог</span>
        </div>

        <div
          style={{
            fontSize: title.length > 60 ? 56 : 68,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            color: "#0F172A",
            display: "flex",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#6B7280",
          }}
        >
          <span>{date}</span>
          <span style={{ color: "#2AABEE", fontWeight: 700 }}>frostybot.ru/blog</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
