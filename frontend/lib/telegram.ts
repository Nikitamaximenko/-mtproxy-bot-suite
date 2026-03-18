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
  const tg = (window as any)?.Telegram
  if (tg?.WebApp?.openLink) {
    tg.WebApp.openLink(url)
    return
  }
  window.location.href = url
}

