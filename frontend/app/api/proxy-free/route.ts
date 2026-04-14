import { NextResponse } from "next/server"

const BACKEND = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/proxy/free`, { cache: "no-store" })
    const text = await res.text()
    return NextResponse.json(JSON.parse(text), { status: res.ok ? 200 : res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
