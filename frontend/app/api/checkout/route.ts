import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { telegram_id, username } = await req.json()

  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"

  const res = await fetch(`${backendUrl}/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_id: telegram_id || 0, username: username || null }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Payment creation failed" }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ payment_url: data.payment_url })
}

