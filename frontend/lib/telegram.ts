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

export function openTelegramLink(url: string) {
  if (typeof window === "undefined") return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wa = (window as any)?.Telegram?.WebApp

  // WebApp.openTelegramLink only accepts https://t.me/ links,
  // so convert tg:// protocol to https://t.me/ equivalent.
  let resolved = normalizePaymentUrl(url)
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
    return
  }

  const isTgLink = resolved.startsWith("https://t.me/")

  try {
    wa?.ready?.()
  } catch {
    /* ignore */
  }

  if (isTgLink && wa?.openTelegramLink) {
    wa.openTelegramLink(resolved)
    return
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
    return
  }
  window.location.assign(resolved)
}

