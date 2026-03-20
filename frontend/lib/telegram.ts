export type TelegramWebAppUser = {
  id: number
  username?: string
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

export function openTelegramLink(url: string) {
  if (typeof window === "undefined") return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wa = (window as any)?.Telegram?.WebApp

  // WebApp.openTelegramLink only accepts https://t.me/ links,
  // so convert tg:// protocol to https://t.me/ equivalent.
  let resolved = url
  if (resolved.startsWith("tg://")) {
    const stripped = resolved.slice("tg://".length)
    resolved = `https://t.me/${stripped}`
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

