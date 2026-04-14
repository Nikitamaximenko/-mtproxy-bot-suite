import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key") || ""
  try {
    const res = await fetch(`${BACKEND}/vpn/online`, {
      headers: { "x-admin-key": adminKey },
      cache: "no-store",
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
