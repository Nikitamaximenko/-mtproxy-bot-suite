import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const email = req.nextUrl.searchParams.get("email")
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  try {
    if (token) {
      const res = await fetch(`${backendUrl}/subscription/token/${token}`)
      if (!res.ok) return NextResponse.json({ active: false })
      const data = await res.json()
      return NextResponse.json({ active: data.found ?? false, proxy_link: data.proxy_link ?? null })
    }
    if (email) {
      const res = await fetch(`${backendUrl}/subscription/by-email/${encodeURIComponent(email)}`)
      if (!res.ok) return NextResponse.json({ active: false })
      return NextResponse.json(await res.json())
    }
    return NextResponse.json({ active: false })
  } catch {
    return NextResponse.json({ active: false })
  }
}
