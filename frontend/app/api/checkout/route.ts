import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { telegram_id, username, email } = await req.json()

  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
  const tgIdNum = Number(telegram_id)
  if (!Number.isFinite(tgIdNum) || tgIdNum < 1) {
    return NextResponse.json(
      { error: "Missing or invalid telegram_id. Open this page from Telegram with ?tg_id=123" },
      { status: 400 }
    )
  }

  const res = await fetch(`${backendUrl}/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegram_id: tgIdNum,
      username: typeof username === "string" && username.trim() ? username.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
    }),
  })

  if (!res.ok) {
    const details = await res.text().catch(() => "")
    return NextResponse.json(
      { error: "Payment creation failed", details: details || undefined },
      { status: 500 }
    )
  }

  const data = await res.json()
  return NextResponse.json({ payment_url: data.payment_url })
}

