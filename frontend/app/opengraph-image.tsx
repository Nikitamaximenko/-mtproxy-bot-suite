import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Frosty — MTProxy + VPN для Telegram и соцсетей"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #2AABEE 100%)",
          padding: 72,
          fontFamily: "sans-serif",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#FFFFFF",
              color: "#2AABEE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            ❄
          </div>
          <span>Frosty</span>
          <span style={{ color: "#93C5FD", fontSize: 22, fontWeight: 500, marginLeft: 8 }}>
            frostybot.ru
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              color: "#BFDBFE",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            2 в 1 — Прокси + VPN
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            Telegram, Instagram, YouTube
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, color: "#93C5FD" }}>
            работают без тормозов
          </div>
          <div style={{ fontSize: 30, fontWeight: 500, color: "#E2E8F0", marginTop: 12 }}>
            Личный MTProxy + VPN · 299 ₽/мес · без логов
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#BFDBFE",
          }}
        >
          <span>Банковские карты · отмена в любой момент</span>
          <span style={{ color: "#FFFFFF", fontWeight: 700 }}>frostybot.ru</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
