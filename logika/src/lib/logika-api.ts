const TOKEN_KEY = 'logika_access_token'

export function getApiBase(): string {
  const u = import.meta.env.VITE_LOGIKA_API_URL as string | undefined
  return (u || '').replace(/\/$/, '')
}

export function hasApi(): boolean {
  return Boolean(getApiBase())
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function req<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const base = getApiBase()
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) (headers as Record<string, string>).Authorization = `Bearer ${token}`
  let body: BodyInit | undefined = init.body as BodyInit | undefined
  if (init.json !== undefined) {
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const r = await fetch(`${base}${path}`, { ...init, headers, body })
  if (!r.ok) {
    let msg = r.statusText
    try {
      const j = await r.json()
      if (typeof j.detail === 'string') msg = j.detail
      else if (Array.isArray(j.detail)) msg = j.detail.map((x: { msg?: string }) => x.msg).join(', ')
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}

export async function requestCode(phone: string) {
  return req<{ ok: boolean }>('/v1/auth/request-code', { method: 'POST', json: { phone } })
}

export async function verifyCode(phone: string, code: string) {
  const data = await req<{ access_token: string; token_type: string }>('/v1/auth/verify', {
    method: 'POST',
    json: { phone, code },
  })
  setToken(data.access_token)
  return data
}

export async function startSession(dilemma: string) {
  return req<{ session_id: string; bot_message: string }>('/v1/sessions/start', {
    method: 'POST',
    json: { dilemma },
  })
}

export async function replySession(sessionId: string, text: string) {
  return req<
    | { bot_message: string; done: false }
    | { done: true; report: Record<string, unknown> }
  >(`/v1/sessions/${sessionId}/reply`, { method: 'POST', json: { text } })
}

export async function downloadPdf(sessionId: string) {
  const base = getApiBase()
  const token = getToken()
  const r = await fetch(`${base}/v1/sessions/${sessionId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error('Не удалось скачать PDF')
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logika-${sessionId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
