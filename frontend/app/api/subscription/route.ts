import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
  const tgIdStr = req.nextUrl.searchParams.get("tg_id")
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing or invalid tg_id" }, { status: 400 })
  }

  const res = await fetch(`${backendUrl}/subscription/${tgId}`, { cache: "no-store" })
  const text = await res.text().catch(() => "")
  if (!res.ok) {
    return NextResponse.json({ error: "Subscription lookup failed", details: text || undefined }, { status: 500 })
  }
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Invalid backend response", details: text || undefined }, { status: 500 })
  }
}

