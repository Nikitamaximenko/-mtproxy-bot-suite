import { NextResponse } from "next/server"
import { fetchBackendWithFailover, getRailwayBackendUrl, getVpsBackendUrl } from "@/lib/backend-url"

export async function GET() {
  try {
    const res = await fetchBackendWithFailover("/health", { cache: "no-store" }, 6000)
    const backend = res.url.includes("railway.app") ? "railway" : "vps"
    return NextResponse.json({ ok: res.ok, backend, vps: getVpsBackendUrl(), railway: getRailwayBackendUrl() })
  } catch {
    return NextResponse.json(
      { ok: false, backend: null, vps: getVpsBackendUrl(), railway: getRailwayBackendUrl() },
      { status: 502 },
    )
  }
}
