import { NextResponse } from "next/server"

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" })
    return NextResponse.json({ ok: res.ok })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
