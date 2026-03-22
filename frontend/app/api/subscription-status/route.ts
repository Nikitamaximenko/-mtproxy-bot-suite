import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return NextResponse.json({ active: false })
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  try {
    const res = await fetch(`${backendUrl}/subscription/token/${token}`)
    if (!res.ok) return NextResponse.json({ active: false })
    const data = await res.json()
    return NextResponse.json({ active: data.found ?? false, proxy_link: data.proxy_link ?? null })
  } catch {
    return NextResponse.json({ active: false })
  }
}
