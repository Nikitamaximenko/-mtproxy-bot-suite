import { NextRequest, NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function POST(
  req: NextRequest,
  { params }: { params: { tg_id: string } },
) {
  const adminKey = req.headers.get("x-admin-key") || ""
  try {
    const res = await fetch(`${BACKEND}/admin/vpn-clients/${params.tg_id}/deactivate`, {
      method: "POST",
      headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
