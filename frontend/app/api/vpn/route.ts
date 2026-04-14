import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET(req: NextRequest) {
  const tgId = Number(req.nextUrl.searchParams.get("tg_id"))
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
  }
  try {
    const res = await fetch(`${BACKEND}/vpn/status/${tgId}`, { cache: "no-store" })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const tgId = Number(req.nextUrl.searchParams.get("tg_id"))
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
  }
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND}/vpn/toggle/${tgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
