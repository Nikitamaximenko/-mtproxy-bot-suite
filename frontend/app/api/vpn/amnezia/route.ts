import { NextRequest, NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/backend-url"

const BACKEND = getBackendUrl()

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

/** GET — только eligible (без ключа). */
export async function GET(req: NextRequest) {
  const tgId = Number(req.nextUrl.searchParams.get("tg_id"))
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
  }
  try {
    const res = await fetch(`${BACKEND}/vpn/amnezia/eligible/${tgId}`, { cache: "no-store" })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/** POST — конфиг AmneziaWG (vpn:// или .conf) с проверкой initData. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tg_id?: unknown; init_data?: unknown }
    const tgId = Number(body.tg_id)
    const initData = typeof body.init_data === "string" ? body.init_data : ""
    if (!Number.isFinite(tgId) || tgId < 1) {
      return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
    }
    const res = await fetch(`${BACKEND}/vpn/amnezia/config/${tgId}`, {
      cache: "no-store",
      headers: backendHeaders(initData),
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
