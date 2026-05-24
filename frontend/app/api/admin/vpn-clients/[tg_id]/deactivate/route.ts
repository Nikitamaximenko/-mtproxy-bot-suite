import { NextRequest, NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/backend-url"

const BACKEND = getBackendUrl()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tg_id: string }> },
) {
  const adminKey = req.headers.get("x-admin-key") || ""
  const { tg_id } = await params
  try {
    const res = await fetch(`${BACKEND}/admin/vpn-clients/${tg_id}/deactivate`, {
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
