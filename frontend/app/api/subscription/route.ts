import { NextRequest, NextResponse } from "next/server"

function backendHeaders(initData?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "X-Internal-Token": process.env.INTERNAL_API_TOKEN || "",
  }
  const raw = (initData || "").trim()
  if (raw) {
    h["X-Telegram-Init-Data"] = raw
  }
  return h
}

export async function GET(req: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

  // Email-based lookup (web users returning to the site)
  const email = req.nextUrl.searchParams.get("email")
  if (email) {
    const res = await fetch(`${backendUrl}/subscription/by-email/${encodeURIComponent(email.trim().toLowerCase())}`, { cache: "no-store" })
    const text = await res.text().catch(() => "")
    try { return NextResponse.json(JSON.parse(text)) } catch {
      return NextResponse.json({ error: "Invalid backend response" }, { status: 500 })
    }
  }

  // tg_id-based lookup (Telegram WebApp users)
  const tgIdStr = req.nextUrl.searchParams.get("tg_id")
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id or email" }, { status: 400 })
  }

  const res = await fetch(`${backendUrl}/subscription/${tgId}`, {
    cache: "no-store",
    headers: backendHeaders(null),
  })
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

/**
 * POST — для Mini App: { tg_id, init_data } чтобы бэкенд отдал proxy_link при валидной
 * подписи Telegram (без совпадения INTERNAL_API_TOKEN на Vercel).
 */
export async function POST(req: NextRequest) {
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  try {
    const body = (await req.json()) as { tg_id?: unknown; init_data?: unknown }
    const tgId = Number(body.tg_id)
    const initData = typeof body.init_data === "string" ? body.init_data : ""
    if (!Number.isFinite(tgId) || tgId < 1) {
      return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
    }
    const res = await fetch(`${backendUrl}/subscription/${tgId}`, {
      method: "GET",
      cache: "no-store",
      headers: backendHeaders(initData),
    })
    const text = await res.text().catch(() => "")
    if (!res.ok) {
      return NextResponse.json({ error: "Subscription lookup failed", details: text || undefined }, { status: 500 })
    }
    try {
      return NextResponse.json(JSON.parse(text))
    } catch {
      return NextResponse.json({ error: "Invalid backend response", details: text || undefined }, { status: 500 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
