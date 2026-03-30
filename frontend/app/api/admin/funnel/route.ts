import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || ""
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  const res = await fetch(`${backendUrl}/admin/funnel`, {
    headers: { "x-admin-key": key },
    cache: "no-store",
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
