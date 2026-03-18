import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const adminKey = req.headers.get("x-admin-key") || ""
  const backendPath = `/admin/${path.join("/")}`

  try {
    const res = await fetch(`${BACKEND_URL}${backendPath}`, {
      cache: "no-store",
      headers: { "x-admin-key": adminKey },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const adminKey = req.headers.get("x-admin-key") || ""
  const backendPath = `/admin/${path.join("/")}`
  const body = await req.text()

  try {
    const res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}
