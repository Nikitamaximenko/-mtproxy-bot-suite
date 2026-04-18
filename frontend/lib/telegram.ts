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
 * Собирает канонический `tg://proxy?server=…&port=…&secret=…` из любой строки API.
 * Нельзя полагаться только на regexp: иначе не матчится `tg://proxy/?…`, лишний слэш и т.п.,
 * код ниже делает `tg://` → `https://t.me/…`, а `openTelegramLink(https://t.me/proxy?…)`
 * в Telegram Desktop открывает профиль @proxy вместо диалога MTProxy.
 */
function parseMtProxyTgLink(raw: string): string | null {
  const s = raw.trim()
  const q = s.indexOf("?")
  if (q < 0) return null
  let params: URLSearchParams
  try {
    params = new URLSearchParams(s.slice(q + 1))
  } catch {
    return null
  }
  const server = params.get("server")?.trim()
  const port = params.get("port")?.trim()
  const secret = params.get("secret")?.trim()
  if (!server || !port || !secret) return null
  const hostPart = s.slice(0, q).toLowerCase()
  const isProxy =
    /tg:\/\/proxy\/?$/i.test(hostPart) ||
    /^https?:\/\/(t\.me|telegram\.me)\/proxy\/?$/i.test(hostPart)
  if (!isProxy) return null
  const out = new URLSearchParams({ server, port, secret })
  return `tg://proxy?${out.toString()}`
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
  // Слэш перед «?» — иначе не матчится tg://proxy/?server=…
  resolved = resolved.replace(/^tg:\/\/proxy\/+(?=\?)/i, "tg://proxy")
  resolved = resolved.replace(/^https?:\/\/t\.me\/proxy\/+(?=\?)/i, "https://t.me/proxy")
  resolved = resolved.replace(/^https?:\/\/telegram\.me\/proxy\/+(?=\?)/i, "https://telegram.me/proxy")

  const mtProxy = parseMtProxyTgLink(resolved)
  if (mtProxy) {
    try {
      wa?.ready?.()
    } catch {
      /* ignore */
    }
    // В WebView Telegram часто блокирует window.location на tg:// — кнопка «молчит».
    // Официальный способ: WebApp.openTelegramLink (поддерживает tg://).
    if (typeof wa?.openTelegramLink === "function") {
      try {
        wa.openTelegramLink(mtProxy)
        return true
      } catch {
        /* fall through */
      }
    }
    // Фолбэк: синтетический клик по ссылке (иногда проходит там, где assign/href режутся).
    try {
      const a = document.createElement("a")
      a.href = mtProxy
      a.setAttribute("rel", "noreferrer")
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      a.remove()
      return true
    } catch {
      /* fall through */
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.location.href = mtProxy
        return true
      }
    } catch {
      /* cross-origin / запрет — ниже */
    }
    try {
      window.location.assign(mtProxy)
    } catch {
      try {
        window.location.href = mtProxy
      } catch {
        return false
      }
    }
    return true
  }

  if (resolved.startsWith("tg://")) {
    // tg://proxy… без успешного parseMtProxyTgLink — не превращать в https://t.me/proxy (это даёт @proxy).
    if (/^tg:\/\/proxy(?:$|[/?#])/i.test(resolved.trim())) {
      return false
    }
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

