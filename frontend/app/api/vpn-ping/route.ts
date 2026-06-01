import { NextRequest, NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/backend-url"

/** TCP до VLESS на 443 (xray). */
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key") || ""
  if (adminKey) {
    try {
      const res = await fetch(`${getBackendUrl()}/admin/vless-status`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      const data = (await res.json()) as {
        online?: boolean
        latency_ms?: number | null
        server?: string
        port?: number
      }
      return NextResponse.json({
        online: Boolean(data.online),
        latency_ms: data.latency_ms ?? null,
        server: data.server,
        port: data.port,
        kind: "vless",
      })
    } catch {
      /* fall through */
    }
  }

  const start = Date.now()
  try {
    const host = process.env.VLESS_PING_HOST || "138.124.80.97"
    const port = Number(process.env.VLESS_PING_PORT || "443")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    await fetch(`https://${host}:${port}`, {
      method: "HEAD",
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    return NextResponse.json({
      online: true,
      latency_ms: Date.now() - start,
      server: host,
      port,
      kind: "vless",
    })
  } catch {
    return NextResponse.json({ online: false, latency_ms: null, kind: "vless" })
  }
}
