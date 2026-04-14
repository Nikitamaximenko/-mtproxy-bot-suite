import { NextResponse } from "next/server"

export async function GET() {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    await fetch("https://www.microsoft.com", {
      method: "HEAD",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const latency = Date.now() - start
    return NextResponse.json({ online: true, latency_ms: latency })
  } catch {
    return NextResponse.json({ online: false, latency_ms: null })
  }
}
