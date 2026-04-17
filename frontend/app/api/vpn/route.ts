import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

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

/** GET — совместимость; без initData бэкенд может вернуть internal_token_required. */
export async function GET(req: NextRequest) {
  const tgId = Number(req.nextUrl.searchParams.get("tg_id"))
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
  }
  try {
    const res = await fetch(`${BACKEND}/vpn/config/${tgId}`, {
      cache: "no-store",
      headers: backendHeaders(null),
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/**
 * POST — предпочтительный путь для Mini App: тело { tg_id, init_data }.
 * init_data подписан Telegram; бэкенд проверяет HMAC и отдаёт vless без совпадения
 * INTERNAL_API_TOKEN между Vercel и Railway.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tg_id?: unknown; init_data?: unknown }
    const tgId = Number(body.tg_id)
    const initData = typeof body.init_data === "string" ? body.init_data : ""
    if (!Number.isFinite(tgId) || tgId < 1) {
      return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
    }
    const res = await fetch(`${BACKEND}/vpn/config/${tgId}`, {
      method: "GET",
      cache: "no-store",
      headers: backendHeaders(initData),
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
