import { NextResponse } from "next/server"
import { getVpsBackendUrl } from "@/lib/backend-url"

// Канонический прод — VPS (sqlite app.db там же). Railway-инстанс пустой,
// поэтому health отражаем ТОЛЬКО по VPS, чтобы баннер аварии был правдивым.
export async function GET() {
  const vps = getVpsBackendUrl()
  try {
    const res = await fetch(`${vps}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
    return NextResponse.json({ ok: res.ok, backend: "vps", vps })
  } catch {
    return NextResponse.json({ ok: false, backend: null, vps }, { status: 502 })
  }
}
