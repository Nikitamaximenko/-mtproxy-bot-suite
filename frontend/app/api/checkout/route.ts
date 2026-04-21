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

function badBackendConfig(): string | null {
  const u = process.env.BACKEND_URL || ""
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || !!process.env.RAILWAY_ENVIRONMENT
  if (isProd && (!u || u.includes("localhost") || u.includes("127.0.0.1"))) {
    return "BACKEND_URL не задан или указывает на localhost — в Railway/Vercel добавь публичный URL бэкенда (например https://xxx.up.railway.app)."
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { telegram_id, username, email, customer_email, payment_provider } = body as {
    telegram_id?: unknown
    username?: unknown
    email?: unknown
    customer_email?: unknown
    payment_provider?: unknown
  }

  const configErr = badBackendConfig()
  if (configErr) {
    console.error("[checkout]", configErr)
    return NextResponse.json(
      { error: "Сервер оплаты не настроен. Обратитесь в поддержку.", details: configErr },
      { status: 503 },
    )
  }

  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  const tgIdNum = Number(telegram_id)
  if (!Number.isFinite(tgIdNum) || tgIdNum < 0) {
    return NextResponse.json(
      { error: "Missing or invalid telegram_id. Open this page from Telegram with ?tg_id=123" },
      { status: 400 },
    )
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 25_000)
  let res: Response
  try {
    res = await fetch(`${backendUrl}/checkout/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: tgIdNum,
        username: typeof username === "string" && username.trim() ? username.trim() : null,
        email: typeof email === "string" && email.trim() ? email.trim() : null,
        customer_email: typeof customer_email === "string" && customer_email.trim() ? customer_email.trim() : null,
        payment_provider:
          payment_provider === "yookassa" || payment_provider === "lava" ? payment_provider : "lava",
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(t)
    console.error("[checkout] fetch to backend failed", backendUrl, e)
    return NextResponse.json(
      {
        error:
          "Не удалось связаться с сервером оплаты. Проверьте, что бэкенд запущен и у фронта задан BACKEND_URL.",
        details: String(e),
      },
      { status: 502 },
    )
  }
  clearTimeout(t)

  if (!res.ok) {
    const raw = await res.text().catch(() => "")
    const backendDetail = raw ? fastapiDetailToString(raw) : ""
    console.error("[checkout] backend error", res.status, backendDetail || raw.slice(0, 500))
    return NextResponse.json(
      {
        error: "Не удалось создать оплату. Попробуйте позже или обратитесь в поддержку.",
        details: backendDetail || raw || undefined,
      },
      { status: res.status >= 400 && res.status < 600 ? res.status : 500 },
    )
  }

  const data = await res.json()
  if (!data?.payment_url) {
    console.error("[checkout] backend returned no payment_url", data)
    return NextResponse.json(
      { error: "Не удалось создать оплату. Попробуйте позже или обратитесь в поддержку." },
      { status: 502 },
    )
  }
  return NextResponse.json({ payment_url: data.payment_url })
}
