import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_PRODAMUS_CHECKOUT !== "true") {
    return NextResponse.json({ error: "Prodamus checkout disabled" }, { status: 503 })
  }
  const { telegram_id, username } = (await req.json()) as {
    telegram_id?: number | string
    username?: string | null
  }
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  const res = await fetch(`${backendUrl}/checkout/create-prodamus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_id: telegram_id || 0, username: username || null }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: "Payment creation failed" }, { status: 500 })
  }
  const data = (await res.json()) as { payment_url?: string }
  return NextResponse.json({ payment_url: data.payment_url })
}
