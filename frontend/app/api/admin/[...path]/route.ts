import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

async function proxyJsonResponse(res: Response) {
  const text = await res.text()
  let data: unknown = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { detail: text }
    }
  }
  return NextResponse.json(data, { status: res.status })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const adminKey = req.headers.get("x-admin-key") || ""
  const backendPath = `/admin/${path.join("/")}${req.nextUrl.search}`

  try {
    const res = await fetch(`${BACKEND_URL}${backendPath}`, {
      cache: "no-store",
      headers: { "x-admin-key": adminKey },
    })
    return proxyJsonResponse(res)
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const adminKey = req.headers.get("x-admin-key") || ""
  const backendPath = `/admin/${path.join("/")}${req.nextUrl.search}`
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
    return proxyJsonResponse(res)
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const adminKey = req.headers.get("x-admin-key") || ""
  const backendPath = `/admin/${path.join("/")}${req.nextUrl.search}`

  try {
    const res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: "DELETE",
      cache: "no-store",
      headers: { "x-admin-key": adminKey },
    })
    return proxyJsonResponse(res)
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}
