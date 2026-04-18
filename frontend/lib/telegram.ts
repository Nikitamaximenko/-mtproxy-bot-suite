export type TelegramWebAppUser = {
  id: number
  username?: string
}

/* Минимальный глобальный тип Telegram WebApp SDK. Подгружается через
 * <Script src="https://telegram.org/js/telegram-web-app.js"> в layout.tsx.
 * Объявляем только те поля, которые реально используем. */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        version?: string
        /** Подписанная строка query; нужна бэкенду для выдачи VPN без INTERNAL_API_TOKEN на Vercel */
        initData?: string
        initDataUnsafe?: { user?: { id: number; username?: string } }
        ready?: () => void
        expand?: () => void
        close?: () => void
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
        openTelegramLink?: (url: string) => void
      }
    }
  }
}

/** Lava может вернуть относительный paymentUrl — иначе в WebApp откроется Vercel и даст 404. */
export function normalizePaymentUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith("//")) return `https:${u}`
  if (/^https?:\/\//i.test(u)) return u
  if (/^tg:/i.test(u)) return u
  const base = "https://gate.lava.top/"
  try {
    return new URL(u, base).href
  } catch {
    return u
  }
}

/** Полная initData из WebApp (подпись Telegram). Пустая вне Telegram или до загрузки SDK. */
export function getTelegramInitData(): string {
  if (typeof window === "undefined") return ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (window as any)?.Telegram?.WebApp?.initData
  return typeof raw === "string" ? raw : ""
}

/** initData после ready(); двойной rAF — строка иногда появляетcя не на первом тике. */
export async function getTelegramInitDataAsync(): Promise<string> {
  if (typeof window === "undefined") return ""
  try {
    window?.Telegram?.WebApp?.ready?.()
  } catch {
    /* ignore */
  }
  let d = getTelegramInitData()
  if (!d && (window as { Telegram?: { WebApp?: { version?: string } } }).Telegram?.WebApp?.version) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    d = getTelegramInitData()
  }
  return d
}

export function getTelegramUser(): TelegramWebAppUser | null {
  if (typeof window === "undefined") return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tg = (window as any)?.Telegram
  const user = tg?.WebApp?.initDataUnsafe?.user
  if (user?.id) {
    return { id: Number(user.id), username: user.username ? String(user.username) : undefined }
  }
  return null
}

/** Non-http(s) links: Telegram WebApp.openLink often no-ops here; use direct navigation. */
function isCustomAppDeepLink(url: string): boolean {
  return /^(happ|vless|vmess|trojan|ss|socks|hy2):\/\//i.test(url.trim())
}

/**
 * Пересобирает MTProxy-ссылки из параметров: так гарантируется кодирование и полный query.
 * `WebApp.openTelegramLink("https://t.me/proxy?…")` в Telegram Desktop часто открывает
 * профиль юзера @proxy, игнорируя query — поэтому для MTProxy этот API не используем.
 */
function buildMtProxyLinksFromQueryString(qs: string): { tgLink: string; tmeLink: string; telegramMeLink: string } | null {
  const raw = qs.trim()
  if (!raw) return null
  const search = raw.startsWith("?") ? raw : `?${raw}`
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search.slice(1))
  } catch {
    return null
  }
  const server = params.get("server")?.trim()
  const port = params.get("port")?.trim()
  const secret = params.get("secret")?.trim()
  if (!server || !port || !secret) return null

  const encoded = new URLSearchParams({ server, port, secret })
  const q = encoded.toString()
  return {
    tgLink: `tg://proxy?${q}`,
    tmeLink: `https://t.me/proxy?${q}`,
    telegramMeLink: `https://telegram.me/proxy?${q}`,
  }
}

/** Синтетический клик по ссылке (иногда срабатывает там, где location.assign на tg:// молчит). */
function openViaAnchorClick(href: string): void {
  if (typeof document === "undefined") return
  const a = document.createElement("a")
  a.href = href
  a.target = "_self"
  a.rel = "noreferrer noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Платёжные ссылки (Lava / Prodamus) мы открываем НЕ через WebApp.openLink,
 * потому что в новых клиентах Telegram (iOS/Android/Desktop) он уводит юзера
 * в системный Safari/Chrome — мини-аппа «выплёвывает» оплату наружу.
 *
 * Правильный способ «оплата внутри TMA» — навигировать сам WebView мини-аппы
 * через window.location. Страница Lava открывается прямо на месте мини-аппа,
 * юзер остаётся внутри Telegram; после успеха Lava делает редирект на
 * successUrl (/success?token=…), и мы возвращаемся в своё приложение уже как
 * обычный next-роут.
 */
export function openPaymentLink(url: string) {
  if (typeof window === "undefined") return
  const resolved = normalizePaymentUrl(url)
  if (!resolved) return
  // Telegram WebApp должен узнать, что мы «уходим» — иначе на iOS бывают
  // артефакты с хедером. ready() безопасно вызывать повторно.
  try {
    window?.Telegram?.WebApp?.ready?.()
  } catch {
    /* ignore */
  }
  try {
    window.location.assign(resolved)
    return
  } catch {
    /* fall through */
  }
  try {
    window.location.href = resolved
    return
  } catch {
    /* fall through */
  }
  // Фолбэк: если WebView вдруг запрещает навигацию (очень редкий кейс), пробуем openLink.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wa = (window as any)?.Telegram?.WebApp
  try {
    wa?.openLink?.(resolved)
  } catch {
    /* ignore */
  }
}

export function openTelegramLink(url: string): boolean {
  if (typeof window === "undefined") return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wa = (window as any)?.Telegram?.WebApp

  let resolved = normalizePaymentUrl(url)
  // Слэш перед «?» ломал regexp (tg://proxy/?server=…) и уводил в общий tg:// → t.me хак.
  resolved = resolved.replace(/^tg:\/\/proxy\/+(?=\?)/i, "tg://proxy")
  resolved = resolved.replace(/^https?:\/\/t\.me\/proxy\/+(?=\?)/i, "https://t.me/proxy")
  resolved = resolved.replace(/^https?:\/\/telegram\.me\/proxy\/+(?=\?)/i, "https://telegram.me/proxy")

  const proxyTg = resolved.match(/^tg:\/\/proxy(\?.*)?$/i)
  const proxyTme = resolved.match(/^https?:\/\/t\.me\/proxy(\?.*)?$/i)
  const proxyTelegramMe = resolved.match(/^https?:\/\/telegram\.me\/proxy(\?.*)?$/i)
  if (proxyTg || proxyTme || proxyTelegramMe) {
    const qs = (proxyTg?.[1] ?? proxyTme?.[1] ?? proxyTelegramMe?.[1] ?? "").trim()
    const built = buildMtProxyLinksFromQueryString(qs)
    if (!built) {
      return false
    }
    const { tgLink, tmeLink, telegramMeLink } = built
    try {
      wa?.ready?.()
    } catch {
      /* ignore */
    }
    // Не используем openTelegramLink для t.me/proxy — в Desktop открывается профиль @proxy.
    // openLink: сначала https (по доке только http(s)); tg:// — последним в цикле.
    if (typeof wa?.openLink === "function") {
      for (const u of [tmeLink, telegramMeLink, tgLink]) {
        try {
          wa.openLink(u, { try_instant_view: false })
          return true
        } catch {
          /* next */
        }
      }
    }
    openViaAnchorClick(tgLink)
    try {
      window.location.assign(tgLink)
      return true
    } catch {
      /* ignore */
    }
    try {
      window.location.href = tgLink
      return true
    } catch {
      /* ignore */
    }
    try {
      window.location.assign(tmeLink)
      return true
    } catch {
      /* ignore */
    }
    try {
      window.location.href = tmeLink
      return true
    } catch {
      /* ignore */
    }
    return false
  }

  if (resolved.startsWith("tg://")) {
    const stripped = resolved.slice("tg://".length)
    resolved = `https://t.me/${stripped}`
  }

  // Happ / VLESS и др.: openLink не открывает кастомные схемы в WebView — только прямой assign
  if (isCustomAppDeepLink(resolved)) {
    try {
      wa?.ready?.()
    } catch {
      /* ignore */
    }
    try {
      window.location.assign(resolved)
    } catch {
      try {
        window.location.href = resolved
      } catch {
        /* ignore */
      }
    }
    return true
  }

  const isTgLink = resolved.startsWith("https://t.me/")

  try {
    wa?.ready?.()
  } catch {
    /* ignore */
  }

  if (isTgLink && wa?.openTelegramLink) {
    wa.openTelegramLink(resolved)
    return true
  }
  if (!isTgLink && typeof wa?.openLink === "function") {
    try {
      // try_instant_view: false — внешняя оплата (Lava и т.д.), не Instant View
      wa.openLink(resolved, { try_instant_view: false })
    } catch {
      try {
        wa.openLink(resolved)
      } catch {
        /* fall through */
      }
    }
    return true
  }
  window.location.assign(resolved)
  return true
}

