import { NextRequest, NextResponse } from "next/server"

function fastapiDetailToString(raw: string): string {
  try {
    const p = JSON.parse(raw)
    if (typeof p?.detail === "string") return p.detail
    if (Array.isArray(p?.detail)) {
      return p.detail
        .map((d: { msg?: string; type?: string }) => d?.msg || JSON.stringify(d))
        .filter(Boolean)
        .join("; ")
    }
  } catch {
    /* not JSON */
  }
  return raw.slice(0, 500)
}

export async function POST(req: NextRequest) {
  const { telegram_id, username, customer_email } = (await req.json()) as {
    telegram_id?: number | string
    username?: string | null
    customer_email?: string | null
  }
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  let res: Response
  try {
    res = await fetch(`${backendUrl}/checkout/create-prodamus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: telegram_id ?? 0,
        username: username || null,
        customer_email: customer_email || null,
      }),
    })
  } catch (e) {
    console.error("[checkout-sbp] fetch failed", backendUrl, e)
    return NextResponse.json(
      { error: "Не удалось связаться с сервером оплаты. Попробуйте позже.", details: String(e) },
      { status: 502 },
    )
  }
  const raw = await res.text().catch(() => "")
  if (!res.ok) {
    const detail = raw ? fastapiDetailToString(raw) : ""
    console.error("[checkout-sbp] backend error", res.status, detail || raw.slice(0, 300))
    return NextResponse.json(
      {
        error: "Не удалось создать оплату через СБП. Попробуйте картой или позже.",
        details: detail || undefined,
      },
      { status: res.status >= 400 && res.status < 600 ? res.status : 500 },
    )
  }
  try {
    const data = JSON.parse(raw) as { payment_url?: string }
    if (!data?.payment_url) {
      return NextResponse.json({ error: "Сервер оплаты не вернул ссылку." }, { status: 502 })
    }
    return NextResponse.json({ payment_url: data.payment_url })
  } catch {
    return NextResponse.json({ error: "Некорректный ответ сервера оплаты." }, { status: 502 })
  }
}
