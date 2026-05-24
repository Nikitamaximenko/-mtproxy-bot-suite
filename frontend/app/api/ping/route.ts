import { NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/backend-url"

export async function GET() {
  const BACKEND_URL = getBackendUrl()
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" })
    return NextResponse.json({ ok: res.ok })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
