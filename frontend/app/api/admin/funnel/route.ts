import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || ""
  const backendUrl = (process.env.BACKEND_URL || "https://138-124-80-97.sslip.io:9443").replace(/\/+$/, "")
  const res = await fetch(`${backendUrl}/admin/funnel`, {
    headers: { "x-admin-key": key },
    cache: "no-store",
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
