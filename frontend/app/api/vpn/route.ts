import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET(req: NextRequest) {
  const tgId = Number(req.nextUrl.searchParams.get("tg_id"))
  if (!Number.isFinite(tgId) || tgId < 1) {
    return NextResponse.json({ error: "Missing tg_id" }, { status: 400 })
  }
  try {
    const res = await fetch(`${BACKEND}/vpn/config/${tgId}`, {
      cache: "no-store",
      headers: { "X-Internal-Token": process.env.INTERNAL_API_TOKEN || "" },
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
