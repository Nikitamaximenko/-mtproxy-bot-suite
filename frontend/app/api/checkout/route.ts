import { NextRequest, NextResponse } from "next/server"

function backendHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Internal-Token": process.env.INTERNAL_API_TOKEN || "",
  }
}

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

async function writeCheckoutLog(
  backendUrl: string,
  payload: {
    stage: string
    provider?: string
    telegram_id?: number
    username?: string | null
    email?: string | null
    customer_email?: string | null
    payment_token?: string | null
    ok: boolean
    payment_url?: string | null
    error?: string | null
    details?: string | null
  },
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_000)
  try {
    await fetch(`${backendUrl}/internal/checkout-log`, {
      method: "POST",
      headers: backendHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    })
  } catch {
    /* checkout logging must never break the response */
  } finally {
    clearTimeout(timer)
  }
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
  const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "")
  const tgIdNum = Number(telegram_id)
  const normalizedUsername = typeof username === "string" && username.trim() ? username.trim() : null
  const normalizedEmail = typeof email === "string" && email.trim() ? email.trim() : null
  const normalizedCustomerEmail = typeof customer_email === "string" && customer_email.trim() ? customer_email.trim() : null
  const provider =
    payment_provider === "yookassa" || payment_provider === "lava" ? payment_provider : "lava"

  const configErr = badBackendConfig()
  if (configErr) {
    console.error("[checkout]", configErr)
    return NextResponse.json(
      { error: "Сервер оплаты не настроен. Обратитесь в поддержку.", details: configErr },
      { status: 503 },
    )
  }
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
      headers: backendHeaders(),
      body: JSON.stringify({
        telegram_id: tgIdNum,
        username: normalizedUsername,
        email: normalizedEmail,
        customer_email: normalizedCustomerEmail,
        payment_provider: provider,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(t)
    console.error("[checkout] fetch to backend failed", backendUrl, e)
    await writeCheckoutLog(backendUrl, {
      stage: "frontend_backend_unreachable",
      provider,
      telegram_id: tgIdNum,
      username: normalizedUsername,
      email: normalizedEmail,
      customer_email: normalizedCustomerEmail,
      ok: false,
      error: "fetch_to_backend_failed",
      details: String(e),
    })
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
    await writeCheckoutLog(backendUrl, {
      stage: "frontend_backend_error",
      provider,
      telegram_id: tgIdNum,
      username: normalizedUsername,
      email: normalizedEmail,
      customer_email: normalizedCustomerEmail,
      ok: false,
      error: `backend_http_${res.status}`,
      details: backendDetail || raw || null,
    })
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
    await writeCheckoutLog(backendUrl, {
      stage: "frontend_missing_payment_url",
      provider,
      telegram_id: tgIdNum,
      username: normalizedUsername,
      email: normalizedEmail,
      customer_email: normalizedCustomerEmail,
      payment_token: typeof data?.payment_token === "string" ? data.payment_token : null,
      ok: false,
      error: "backend_returned_no_payment_url",
      details: JSON.stringify(data).slice(0, 1000),
    })
    return NextResponse.json(
      { error: "Не удалось создать оплату. Попробуйте позже или обратитесь в поддержку." },
      { status: 502 },
    )
  }
  await writeCheckoutLog(backendUrl, {
    stage: "frontend_checkout_ok",
    provider,
    telegram_id: tgIdNum,
    username: normalizedUsername,
    email: normalizedEmail,
    customer_email: normalizedCustomerEmail,
    payment_token: typeof data?.payment_token === "string" ? data.payment_token : null,
    ok: true,
    payment_url: String(data.payment_url),
  })
  return NextResponse.json({ payment_url: data.payment_url })
}
